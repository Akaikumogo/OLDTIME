"""
Service supervisor — backend startupда yordamchi jarayonlarni ishga tushiradi
va shutdownда to'xtatadi. Hozircha: go2rtc (media gateway) va odam aniqlash worker.

Maqsad: foydalanuvchi faqat backend'ni ishga tushirsa, qolgan hamma narsa
o'z-o'zidan ko'tariladi. Hech qanday alohida jarayon yoki token kerak emas.

Har bir jarayon alohida thread'da kuzatiladi va o'chib qolsa qayta ishga tushadi
(ketma-ket tez yiqilishlar bo'lsa — to'xtatiladi, log yoziladi).
"""

import logging
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

logger = logging.getLogger(__name__)

# services/ -> Backend/ -> <project root>
PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _truthy(value: str | None, default: bool = True) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class ManagedProcess:
    """Bitta tashqi jarayonni boshqaradi (start / nazorat / restart / stop)."""

    FAST_FAIL_SECONDS = 15
    MAX_FAST_FAILS = 3
    RESTART_DELAY = 3

    def __init__(self, name: str, cmd: list[str], cwd: str | None = None,
                 env: dict | None = None):
        self.name = name
        self.cmd = cmd
        self.cwd = cwd
        self.env = env
        self.proc: subprocess.Popen | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self):
        self._thread = threading.Thread(target=self._supervise, daemon=True, name=f"svc-{self.name}")
        self._thread.start()

    def _spawn(self) -> subprocess.Popen:
        full_env = {**os.environ, **(self.env or {})}
        return subprocess.Popen(self.cmd, cwd=self.cwd, env=full_env)

    def _supervise(self):
        fast_fails = 0
        while not self._stop.is_set():
            started = time.time()
            try:
                logger.info(f"▶️  {self.name} ishga tushyapti: {' '.join(self.cmd)}")
                self.proc = self._spawn()
            except FileNotFoundError:
                logger.warning(f"❌ {self.name}: bajariladigan fayl topilmadi ({self.cmd[0]}) — o'tkazib yuborildi")
                return
            except Exception as exc:
                logger.warning(f"❌ {self.name} ishga tushmadi: {exc}")
                return

            while not self._stop.is_set():
                if self.proc.poll() is not None:
                    break
                time.sleep(1)

            if self._stop.is_set():
                break

            code = self.proc.poll()
            ran_for = time.time() - started
            logger.warning(f"⚠️  {self.name} to'xtadi (code={code}, {ran_for:.0f}s ishladi)")

            if ran_for < self.FAST_FAIL_SECONDS:
                fast_fails += 1
            else:
                fast_fails = 0

            if fast_fails >= self.MAX_FAST_FAILS:
                logger.error(
                    f"🛑 {self.name} ketma-ket {fast_fails} marta tez yiqildi — "
                    f"qayta urinish to'xtatildi. Bog'liqliklar/sozlamalarni tekshiring."
                )
                return

            time.sleep(self.RESTART_DELAY)

        logger.info(f"⏹️  {self.name} supervisor to'xtadi")

    def stop(self):
        self._stop.set()
        proc = self.proc
        if proc and proc.poll() is None:
            try:
                proc.terminate()
                try:
                    proc.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    proc.kill()
            except Exception as exc:
                logger.warning(f"{self.name} to'xtatishda xato: {exc}")
        if self._thread:
            self._thread.join(timeout=3)


class ServiceSupervisor:
    """go2rtc va recognition worker'ni birga boshqaradi."""

    def __init__(self):
        self.processes: list[ManagedProcess] = []

    def _build_go2rtc(self) -> ManagedProcess | None:
        if not _truthy(os.getenv("AUTOSTART_GO2RTC"), default=True):
            logger.info("go2rtc: AUTOSTART_GO2RTC=false — o'tkazib yuborildi")
            return None

        default_name = "go2rtc.exe" if sys.platform.startswith("win") else "go2rtc"
        binary = os.getenv("GO2RTC_BINARY") or str(PROJECT_ROOT / "go2rtc" / default_name)
        if not Path(binary).exists():
            logger.warning(f"go2rtc topilmadi: {binary} (GO2RTC_BINARY bilan ko'rsating) — o'tkazib yuborildi")
            return None

        cmd = [binary]
        config = os.getenv("GO2RTC_CONFIG")
        if config:
            cmd += ["-config", config]

        return ManagedProcess("go2rtc", cmd, cwd=str(Path(binary).parent))

    def _build_recognition(self) -> ManagedProcess | None:
        if not _truthy(os.getenv("AUTOSTART_RECOGNITION"), default=True):
            logger.info("recognition: AUTOSTART_RECOGNITION=false — o'tkazib yuborildi")
            return None

        python_bin = os.getenv("RECOGNITION_PYTHON") or sys.executable
        script = os.getenv("RECOGNITION_SCRIPT") or str(PROJECT_ROOT / "human_recognition_worker.py")
        if not Path(script).exists():
            logger.warning(f"recognition worker topilmadi: {script} — o'tkazib yuborildi")
            return None

        child_env = {
            "WORKPLUS_API_URL": os.getenv("RECOGNITION_API_URL", "http://localhost:8000"),
            "PYTHONUTF8": "1",
            "PYTHONIOENCODING": "utf-8",
        }
        return ManagedProcess(
            "recognition",
            [python_bin, script],
            cwd=str(PROJECT_ROOT),
            env=child_env,
        )

    def _build_enrollment(self) -> ManagedProcess | None:
        if not _truthy(os.getenv("AUTOSTART_ENROLLMENT"), default=True):
            logger.info("enrollment: AUTOSTART_ENROLLMENT=false — o'tkazib yuborildi")
            return None

        python_bin = os.getenv("RECOGNITION_PYTHON") or sys.executable
        script = os.getenv("ENROLLMENT_SCRIPT") or str(PROJECT_ROOT / "enroll_faces.py")
        if not Path(script).exists():
            logger.warning(f"enroll skript topilmadi: {script} — o'tkazib yuborildi")
            return None

        interval = os.getenv("ENROLLMENT_INTERVAL", "120")
        # Enrollment kamdan-kam ishlaydi — VRAM tejash uchun default CPU
        child_env = {
            "WORKPLUS_API_URL": os.getenv("RECOGNITION_API_URL", "http://localhost:8000"),
            "WORKER_DEVICE": os.getenv("ENROLLMENT_DEVICE", "cpu"),
            "PYTHONUTF8": "1",
            "PYTHONIOENCODING": "utf-8",
        }
        return ManagedProcess(
            "enrollment",
            [python_bin, script, "--watch", "--interval", interval],
            cwd=str(PROJECT_ROOT),
            env=child_env,
        )

    def start_all(self):
        for builder in (self._build_go2rtc, self._build_recognition, self._build_enrollment):
            try:
                proc = builder()
            except Exception as exc:
                logger.warning(f"Service build xatosi: {exc}")
                proc = None
            if proc:
                proc.start()
                self.processes.append(proc)

    def stop_all(self):
        for proc in reversed(self.processes):
            proc.stop()
        self.processes.clear()
