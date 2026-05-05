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
import socket
import subprocess
import sys
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib import request
from urllib.error import URLError

AGENT_VERSION = "1.0.0"
BACKEND_URL = os.getenv("WORKPLUS_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
AGENT_TOKEN = os.getenv("WORKPLUS_AGENT_TOKEN")
EMPLOYEE_ID = os.getenv("WORKPLUS_EMPLOYEE_ID") or None
POLL_SECONDS = int(os.getenv("WORKPLUS_POLL_SECONDS", "5"))
FLUSH_SECONDS = int(os.getenv("WORKPLUS_FLUSH_SECONDS", "30"))
HEARTBEAT_SECONDS = int(os.getenv("WORKPLUS_HEARTBEAT_SECONDS", "60"))
COLLECT_URLS = os.getenv("WORKPLUS_COLLECT_URLS", "false").lower() == "true"
QUEUE_FILE = Path(os.getenv("WORKPLUS_QUEUE_FILE", "workplus_agent_queue.jsonl"))
MAX_QUEUE_EVENTS = int(os.getenv("WORKPLUS_MAX_QUEUE_EVENTS", "5000"))


@dataclass
class ActivityEvent:
    app_name: str
    window_title: Optional[str]
    url: Optional[str]
    started_at: str
    ended_at: str
    duration_seconds: int


def now_iso() -> str:
    return datetime.now().replace(microsecond=0).isoformat()


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
    return url or None


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


def active_window_linux() -> tuple[str, str]:
    title = run_command(["xdotool", "getactivewindow", "getwindowname"])
    return "Unknown", title


def get_active_context() -> tuple[str, str, Optional[str]]:
    system = platform.system()
    if system == "Darwin":
        app, title = active_window_macos()
        return app, title, browser_url_macos(app)
    if system == "Windows":
        app, title = active_window_windows()
        return app, title, None
    return (*active_window_linux(), None)


def append_queue(event: ActivityEvent) -> None:
    if event.duration_seconds <= 0:
        return
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
            if line:
                rows.append(json.loads(line))
    return rows


def trim_queue() -> None:
    rows = read_queue()
    if len(rows) <= MAX_QUEUE_EVENTS:
        return
    with QUEUE_FILE.open("w", encoding="utf-8") as file:
        for row in rows[-MAX_QUEUE_EVENTS:]:
            file.write(json.dumps(row, ensure_ascii=False) + "\n")


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
            "mac_address": get_mac_address(),
            "employee_id": EMPLOYEE_ID,
            "events": events,
        },
    )
    clear_queue()


def main() -> int:
    if not AGENT_TOKEN or len(AGENT_TOKEN.encode("utf-8")) < 32:
        print("WORKPLUS_AGENT_TOKEN must be configured and at least 32 bytes", file=sys.stderr)
        return 2

    print("WorkPlus desktop agent started")
    print(f"Backend: {BACKEND_URL}")
    print("URL collection:", "enabled" if COLLECT_URLS else "disabled")

    last_context = None
    started_at = now_iso()
    last_flush = time.time()
    last_heartbeat = 0.0

    while True:
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
                started_dt = datetime.fromisoformat(started_at)
                ended_dt = datetime.fromisoformat(current_time)
                duration = max(int((ended_dt - started_dt).total_seconds()), 0)
                append_queue(
                    ActivityEvent(
                        app_name=last_context[0],
                        window_title=last_context[1],
                        url=last_context[2],
                        started_at=started_at,
                        ended_at=current_time,
                        duration_seconds=duration,
                    )
                )
                last_context = context
                started_at = current_time

            if current_monotonic - last_flush >= FLUSH_SECONDS:
                flush_queue()
                last_flush = current_monotonic
        except (URLError, TimeoutError, OSError) as exc:
            print(f"Agent network/system warning: {exc}", file=sys.stderr)
        except KeyboardInterrupt:
            flush_queue()
            print("WorkPlus desktop agent stopped")
            return 0
        except Exception as exc:
            print(f"Agent warning: {exc}", file=sys.stderr)

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    raise SystemExit(main())
