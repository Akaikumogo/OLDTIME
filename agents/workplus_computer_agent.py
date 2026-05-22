"""
WorkPlus desktop activity agent.

This agent is designed for transparent company-device monitoring only.
It does not collect keystrokes, passwords, files, screenshots, or hidden history.

Build later with:
    pyinstaller --onefile --name WorkPlusAgent workplus_computer_agent.py
"""

from __future__ import annotations

import json
import os
import platform
import signal
import socket
import subprocess
import sys
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
from urllib import request
from urllib.error import URLError

AGENT_VERSION = "1.0.0"
BACKEND_URL = os.getenv("WORKPLUS_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
AGENT_TOKEN = os.getenv("WORKPLUS_AGENT_TOKEN")
EMPLOYEE_ID = os.getenv("WORKPLUS_EMPLOYEE_ID") or None
POLL_SECONDS = int(os.getenv("WORKPLUS_POLL_SECONDS", "5"))
FLUSH_SECONDS = int(os.getenv("WORKPLUS_FLUSH_SECONDS", "30"))
HEARTBEAT_SECONDS = int(os.getenv("WORKPLUS_HEARTBEAT_SECONDS", "60"))
COLLECT_URLS = os.getenv("WORKPLUS_COLLECT_URLS", "true").lower() == "true"
IDLE_THRESHOLD_SECONDS = int(os.getenv("WORKPLUS_IDLE_THRESHOLD_SECONDS", "300"))
MAX_QUEUE_EVENTS = int(os.getenv("WORKPLUS_MAX_QUEUE_EVENTS", "5000"))
APP_DIR_ENV = os.getenv("WORKPLUS_APP_DIR")
QUEUE_FILE_ENV = os.getenv("WORKPLUS_QUEUE_FILE")
DEVICE_ID_FILE_ENV = os.getenv("WORKPLUS_DEVICE_ID_FILE")
STOP_REQUESTED = False


@dataclass
class ActivityEvent:
    app_name: str
    window_title: Optional[str]
    url: Optional[str]
    started_at: str
    ended_at: str
    duration_seconds: int


def request_stop(signum, frame) -> None:
    del signum, frame
    global STOP_REQUESTED
    STOP_REQUESTED = True


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def get_app_dir() -> Path:
    if APP_DIR_ENV:
        path = Path(APP_DIR_ENV)
    elif platform.system() == "Windows":
        path = Path(os.getenv("PROGRAMDATA", str(Path.home()))) / "WorkPlus"
    elif platform.system() == "Darwin":
        path = Path.home() / "Library" / "Application Support" / "WorkPlus"
    else:
        path = Path(os.getenv("XDG_STATE_HOME", str(Path.home() / ".local" / "state"))) / "workplus"
    path.mkdir(parents=True, exist_ok=True)
    return path


APP_DIR = get_app_dir()
QUEUE_FILE = Path(QUEUE_FILE_ENV) if QUEUE_FILE_ENV else APP_DIR / "activity_queue.jsonl"
DEVICE_ID_FILE = Path(DEVICE_ID_FILE_ENV) if DEVICE_ID_FILE_ENV else APP_DIR / "device_id"


def get_device_id() -> str:
    try:
        if DEVICE_ID_FILE.exists():
            value = DEVICE_ID_FILE.read_text(encoding="utf-8").strip()
            if 8 <= len(value) <= 64:
                return value
        value = uuid.uuid4().hex
        DEVICE_ID_FILE.parent.mkdir(parents=True, exist_ok=True)
        DEVICE_ID_FILE.write_text(value + "\n", encoding="utf-8")
        return value
    except OSError:
        return uuid.uuid5(uuid.NAMESPACE_DNS, f"{socket.gethostname()}-{get_mac_address()}").hex


def get_mac_address() -> str:
    mac = uuid.getnode()
    return ":".join(f"{(mac >> shift) & 0xff:02x}" for shift in range(40, -1, -8))


def get_ip_address() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def post_json(path: str, payload: dict, timeout: int = 15) -> dict:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        f"{BACKEND_URL}{path}",
        data=body,
        headers={
            "Authorization": f"Bearer {AGENT_TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": f"WorkPlusAgent/{AGENT_VERSION}",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=timeout) as response:
        data = response.read().decode("utf-8")
        return json.loads(data) if data else {}


def heartbeat() -> None:
    post_json(
        "/internal/computers/heartbeat",
        {
            "device_id": get_device_id(),
            "hostname": socket.gethostname(),
            "mac_address": get_mac_address(),
            "ip_address": get_ip_address(),
            "os_name": f"{platform.system()} {platform.release()}",
            "agent_version": AGENT_VERSION,
            "employee_id": EMPLOYEE_ID,
        },
    )


def run_command(args: list[str]) -> str:
    try:
        return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


def active_window_macos() -> tuple[str, str]:
    script = (
        'tell application "System Events"\n'
        'set frontApp to name of first application process whose frontmost is true\n'
        'set windowTitle to ""\n'
        'try\n'
        'set windowTitle to name of front window of process frontApp\n'
        'end try\n'
        'return frontApp & "||" & windowTitle\n'
        'end tell'
    )
    output = run_command(["osascript", "-e", script])
    if "||" in output:
        app, title = output.split("||", 1)
        return app or "Unknown", title or ""
    return "Unknown", ""


def browser_url_macos(app_name: str) -> Optional[str]:
    if not COLLECT_URLS:
        return None
    browser_scripts = {
        "Google Chrome": 'tell application "Google Chrome" to get URL of active tab of front window',
        "Microsoft Edge": 'tell application "Microsoft Edge" to get URL of active tab of front window',
        "Safari": 'tell application "Safari" to get URL of front document',
    }
    script = browser_scripts.get(app_name)
    if not script:
        return None
    url = run_command(["osascript", "-e", script])
    return sanitize_url(url)


def sanitize_url(url: str | None) -> Optional[str]:
    if not url:
        return None
    parsed = urlparse(url)
    if not parsed.netloc:
        return None
    scheme = parsed.scheme if parsed.scheme in {"http", "https"} else "https"
    return f"{scheme}://{parsed.netloc.lower().removeprefix('www.')}"


def active_window_windows() -> tuple[str, str]:
    try:
        import psutil  # type: ignore
        import win32gui  # type: ignore
        import win32process  # type: ignore
    except Exception:
        return "Unknown", ""

    hwnd = win32gui.GetForegroundWindow()
    title = win32gui.GetWindowText(hwnd)
    _, pid = win32process.GetWindowThreadProcessId(hwnd)
    app_name = "Unknown"
    try:
        app_name = psutil.Process(pid).name()
    except Exception:
        pass
    return app_name, title


def idle_seconds_windows() -> int:
    try:
        import ctypes
        from ctypes import wintypes

        class LASTINPUTINFO(ctypes.Structure):
            _fields_ = [("cbSize", wintypes.UINT), ("dwTime", wintypes.DWORD)]

        last_input = LASTINPUTINFO()
        last_input.cbSize = ctypes.sizeof(LASTINPUTINFO)
        if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(last_input)):
            return 0
        tick_count = ctypes.windll.kernel32.GetTickCount()
        return max(0, int((tick_count - last_input.dwTime) / 1000))
    except Exception:
        return 0


def browser_url_windows(hwnd: int, app_name: str) -> Optional[str]:
    if not COLLECT_URLS:
        return None
    lowered = app_name.lower()
    if not any(token in lowered for token in ("chrome", "msedge", "firefox", "browser")):
        return None
    try:
        from pywinauto import Desktop  # type: ignore
    except Exception:
        return None

    try:
        window = Desktop(backend="uia").window(handle=hwnd)
        edits = window.descendants(control_type="Edit")
    except Exception:
        return None

    candidates = []
    for edit in edits[:12]:
        try:
            value = edit.get_value()
        except Exception:
            value = ""
        try:
            name = edit.window_text()
        except Exception:
            name = ""
        text = value or name
        url = sanitize_url(text)
        if url:
            candidates.append(url)
    return candidates[0] if candidates else None


def active_window_linux() -> tuple[str, str]:
    title = run_command(["xdotool", "getactivewindow", "getwindowname"])
    return "Unknown", title


def get_active_context() -> tuple[str, str, Optional[str]]:
    system = platform.system()
    if system == "Darwin":
        app, title = active_window_macos()
        return app, title, browser_url_macos(app)
    if system == "Windows":
        if idle_seconds_windows() >= IDLE_THRESHOLD_SECONDS:
            return "__idle__", "User idle", None
        app, title = active_window_windows()
        try:
            import win32gui  # type: ignore

            hwnd = win32gui.GetForegroundWindow()
        except Exception:
            hwnd = 0
        return app, title, browser_url_windows(hwnd, app)
    return (*active_window_linux(), None)


def append_queue(event: ActivityEvent) -> None:
    if event.duration_seconds <= 0:
        return
    QUEUE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with QUEUE_FILE.open("a", encoding="utf-8") as file:
        file.write(json.dumps(asdict(event), ensure_ascii=False) + "\n")
    trim_queue()


def read_queue() -> list[dict]:
    if not QUEUE_FILE.exists():
        return []
    rows = []
    with QUEUE_FILE.open("r", encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                print(f"Agent queue warning: skipped corrupt row ({exc})", file=sys.stderr)
    return rows


def write_queue(rows: list[dict]) -> None:
    QUEUE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp_file = QUEUE_FILE.with_suffix(QUEUE_FILE.suffix + ".tmp")
    with tmp_file.open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row, ensure_ascii=False) + "\n")
    tmp_file.replace(QUEUE_FILE)


def record_context_event(
    context: tuple[str, str, Optional[str]] | None,
    started_at: str,
    ended_at: str,
) -> bool:
    if context is None:
        return False
    started_dt = datetime.fromisoformat(started_at)
    ended_dt = datetime.fromisoformat(ended_at)
    duration = max(int((ended_dt - started_dt).total_seconds()), 0)
    append_queue(
        ActivityEvent(
            app_name=context[0],
            window_title=context[1],
            url=context[2],
            started_at=started_at,
            ended_at=ended_at,
            duration_seconds=duration,
        )
    )
    return duration > 0


def trim_queue() -> None:
    rows = read_queue()
    if len(rows) <= MAX_QUEUE_EVENTS:
        return
    write_queue(rows[-MAX_QUEUE_EVENTS:])


def clear_queue() -> None:
    if QUEUE_FILE.exists():
        QUEUE_FILE.unlink()


def flush_queue() -> None:
    events = read_queue()
    if not events:
        return
    post_json(
        "/internal/computer-activity/events",
        {
            "device_id": get_device_id(),
            "mac_address": get_mac_address(),
            "employee_id": EMPLOYEE_ID,
            "events": events,
        },
    )
    clear_queue()


def main() -> int:
    global STOP_REQUESTED
    if not AGENT_TOKEN or len(AGENT_TOKEN.encode("utf-8")) < 32:
        print("WORKPLUS_AGENT_TOKEN must be configured and at least 32 bytes", file=sys.stderr)
        return 2

    signal.signal(signal.SIGINT, request_stop)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, request_stop)

    print("WorkPlus desktop agent started")
    print(f"Backend: {BACKEND_URL}")
    print(f"Device ID: {get_device_id()}")
    print(f"Data directory: {APP_DIR}")
    print("URL collection:", "enabled" if COLLECT_URLS else "disabled")

    last_context = None
    started_at = now_iso()
    last_flush = time.time()
    last_heartbeat = 0.0

    while not STOP_REQUESTED:
        try:
            current_monotonic = time.time()
            if current_monotonic - last_heartbeat >= HEARTBEAT_SECONDS:
                heartbeat()
                last_heartbeat = current_monotonic

            app_name, title, url = get_active_context()
            context = (app_name, title, url)
            current_time = now_iso()

            if last_context is None:
                last_context = context
                started_at = current_time
            elif context != last_context:
                record_context_event(last_context, started_at, current_time)
                last_context = context
                started_at = current_time

            if current_monotonic - last_flush >= FLUSH_SECONDS:
                if record_context_event(last_context, started_at, current_time):
                    started_at = current_time
                flush_queue()
                last_flush = current_monotonic
        except (URLError, TimeoutError, OSError) as exc:
            print(f"Agent network/system warning: {exc}", file=sys.stderr)
        except KeyboardInterrupt:
            STOP_REQUESTED = True
        except Exception as exc:
            print(f"Agent warning: {exc}", file=sys.stderr)

        if STOP_REQUESTED:
            break
        time.sleep(POLL_SECONDS)

    record_context_event(last_context, started_at, now_iso())
    try:
        flush_queue()
    except Exception as exc:
        print(f"Agent shutdown warning: queued activity was kept locally ({exc})", file=sys.stderr)
    print("WorkPlus desktop agent stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
