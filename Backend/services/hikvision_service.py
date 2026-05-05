import logging
import threading
import time
import uuid
from collections import deque
from datetime import datetime

import requests
from requests.auth import HTTPDigestAuth

from services.device_service import (
    append_raw_log,
    fetch_active_doors,
    get_active_door_count,
    read_hikvision_settings,
)
from services.event_service import (
    EventProcessor,
    attach_attendance_picture,
    persist_attendance_event_detailed,
)
from services.image_service import download_face_image

logger = logging.getLogger(__name__)

ALLOWED_MINOR_CODES = {1, 75}
MAX_EVENTS_HISTORY = 100


class HikvisionPollingService:
    def __init__(self, ip: str, username: str, password: str, scheme: str = "http", port: int = 80):
        self.ip = ip
        self.auth = HTTPDigestAuth(username, password)
        self.scheme = scheme or "http"
        self.port = port or 80

    def fetch_events(self, max_results: int = 10):
        port_suffix = f":{self.port}" if self.port not in (80, 443) else ""
        url = f"{self.scheme}://{self.ip}{port_suffix}/ISAPI/AccessControl/AcsEvent?format=json"
        payload = {
            "AcsEventCond": {
                "searchID": str(uuid.uuid4()),
                "searchResultPosition": 0,
                "maxResults": max_results,
                "major": 0,
                "minor": 0,
                "timeReverseOrder": True,
                "picEnable": True,
            }
        }
        response = requests.post(
            url,
            json=payload,
            auth=self.auth,
            timeout=15,
            allow_redirects=False,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("AcsEvent", {}).get("InfoList", [])


class HikvisionPollingEngine:
    def __init__(self):
        self.settings = read_hikvision_settings()
        self.processor = EventProcessor()
        self.stop_event = threading.Event()
        self.thread = None
        self.last_seen_time = {}
        self.last_error = None
        self.last_tick_at = None
        self.failed_until = {}
        self.device_health = {}
        self.events_history = deque(maxlen=MAX_EVENTS_HISTORY)
        self.events_lock = threading.Lock()
        self._offline_logged_at = {}
        self.stats = {
            "total_events_processed": 0,
            "total_events_skipped": 0,
            "total_errors": 0,
        }
        logger.info("🚀 HikvisionPollingEngine initialized")

    def start(self):
        if not self.settings["enabled"]:
            logger.info("Hikvision polling disabled by configuration")
            return
        if not self.settings["username"] or not self.settings["password"]:
            logger.warning("Hikvision polling skipped: credentials not configured")
            return
        if self.thread and self.thread.is_alive():
            return

        self.thread = threading.Thread(target=self._run, daemon=True, name="hikvision-poller")
        self.thread.start()
        logger.info("Hikvision polling started")

    def stop(self):
        self.stop_event.set()
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        logger.info("Hikvision polling stopped")

    def status(self):
        with self.events_lock:
            events_history = list(self.events_history)
        
        return {
            "running": bool(self.thread and self.thread.is_alive()),
            "poll_interval_seconds": self.settings["poll_interval"],
            "active_doors": get_active_door_count(),
            "last_tick_at": self.last_tick_at,
            "last_error": self.last_error,
            "stats": self.stats,
            "recent_events": events_history,
        }

    def get_device_health(self, ip_address: str):
        return self.device_health.get(
            ip_address,
            {
                "status": "unknown",
                "last_checked_at": None,
                "last_success_at": None,
                "last_error": None,
            },
        )

    def _run(self):
        while not self.stop_event.is_set():
            doors = fetch_active_doors()
            for door in doors:
                if self.stop_event.is_set():
                    break
                self._poll_door(door)
            self.stop_event.wait(self.settings["poll_interval"])

    def _poll_door(self, door_row):
        door_id = str(door_row[0])
        door_name = door_row[1]
        ip_address = door_row[2]
        event_type = door_row[3]
        now = time.time()
        
        logger.debug(f"🔍 Polling door: {door_name} ({ip_address})")
        
        if self.failed_until.get(ip_address, 0) > now:
            logger.debug(f"⏸️  Device {ip_address} in cooldown, skipping")
            return

        client = HikvisionPollingService(
            ip=ip_address,
            username=self.settings["username"],
            password=self.settings["password"],
            scheme=self.settings["scheme"],
            port=self.settings["port"],
        )

        try:
            self.last_tick_at = time.strftime("%Y-%m-%d %H:%M:%S")
            logger.info(f"📡 Fetching events from {door_name} ({ip_address})")
            events = client.fetch_events(self.settings["max_results"])
            self._mark_device_online(ip_address)
            
            if not events:
                logger.debug(f"📭 No events from {ip_address}")
                return

            newest_time = events[0].get("time")
            if self.last_seen_time.get(ip_address) == newest_time:
                logger.debug(f"🔄 Already processed latest event from {ip_address}")
                return
            
            self.last_seen_time[ip_address] = newest_time
            logger.info(f"📥 Got {len(events)} new events from {door_name}")

            append_raw_log(
                self.settings["raw_log_file"],
                {
                    "door_id": door_id,
                    "door_name": door_name,
                    "ip": ip_address,
                    "events": events,
                },
            )

            for raw_event in events:
                self._process_event(client, door_id, ip_address, event_type, raw_event)
                
        except requests.exceptions.Timeout:
            self._mark_device_error(ip_address, "timeout")
            logger.error(f"❌ Timeout connecting to {ip_address}")
        except requests.exceptions.HTTPError as exc:
            self._mark_device_error(ip_address, f"http error: {exc}")
            logger.error(f"❌ HTTP Error from {ip_address}: {exc}")
        except requests.exceptions.ConnectionError as exc:
            self._mark_device_error(ip_address, f"connection error: {exc}")
            logger.error(f"❌ Connection Error to {ip_address}: {exc}")
        except requests.exceptions.RequestException as exc:
            self._mark_device_error(ip_address, f"request error: {exc}")
            logger.error(f"❌ Request Error from {ip_address}: {exc}")
        except Exception as exc:
            self._mark_device_error(ip_address, f"unexpected error: {exc}")
            logger.error(f"❌ Unexpected Error from {ip_address}: {exc}", exc_info=True)
            self.stats["total_errors"] += 1

    def _mark_device_error(self, ip_address: str, reason: str):
        self.last_error = f"{ip_address}: {reason}"
        self.failed_until[ip_address] = time.time() + max(self.settings["poll_interval"] * 6, 30)
        previous = self.device_health.get(ip_address, {})
        previous_error = previous.get("last_error")
        previous_status = previous.get("status")
        should_warn = previous_status != "offline" or previous_error != reason
        self.device_health[ip_address] = {
            "status": "offline",
            "last_checked_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "last_success_at": self.device_health.get(ip_address, {}).get("last_success_at"),
            "last_error": reason,
        }
        if should_warn:
            logger.warning(f"❌ Hikvision polling failed for {ip_address}: {reason}")
        else:
            logger.debug(f"⏸️ Hikvision still offline for {ip_address}: {reason}")
        self.stats["total_errors"] += 1

    def _mark_device_online(self, ip_address: str):
        checked_at = time.strftime("%Y-%m-%d %H:%M:%S")
        self.device_health[ip_address] = {
            "status": "online",
            "last_checked_at": checked_at,
            "last_success_at": checked_at,
            "last_error": None,
        }
        logger.debug(f"✅ Device {ip_address} is online")

    def _process_event(self, client, door_id, device_ip, event_type, raw_event):
        parsed = self.processor.parse_event(raw_event)
        
        logger.debug(f"📋 Parsing event: card_id={parsed['card_id']}, name={parsed['employee_name']}, time={parsed['timestamp']}")
        
        if raw_event.get("minor") not in ALLOWED_MINOR_CODES:
            logger.debug(f"⚠️  Skipped event - minor code {raw_event.get('minor')} not allowed")
            self.stats["total_events_skipped"] += 1
            return
        
        if not parsed["card_id"] and not parsed["employee_name"]:
            logger.warning(
                f"⛔ CRITICAL: Event without card_id and employee_name - "
                f"door={door_id}, device={device_ip}, timestamp={parsed['timestamp']}, "
                f"serial_no={parsed['serial_no']}, raw={raw_event}"
            )
            self.stats["total_events_skipped"] += 1
            
            with self.events_lock:
                self.events_history.append({
                    "timestamp": datetime.now().isoformat(),
                    "type": "SKIPPED_NO_ID",
                    "door_id": door_id,
                    "device_ip": device_ip,
                    "reason": "No card_id and no employee_name",
                    "raw_data": {
                        "serial_no": parsed["serial_no"],
                        "event_time": parsed["timestamp"],
                    }
                })
            return

        event_key = self.processor.generate_event_key(
            device_ip,
            str(parsed["card_id"] or parsed["employee_name"]),
            parsed["timestamp"],
            parsed["serial_no"],
        )
        if self.processor.is_duplicate(event_key):
            logger.debug(f"🔄 Duplicate event, skipping - key: {event_key}")
            self.stats["total_events_skipped"] += 1
            return

        logger.info(f"✅ Processing event: {parsed['employee_name'] or parsed['card_id']} at {parsed['timestamp']}")
        
        result = persist_attendance_event_detailed(
            door_id=door_id,
            door_ip=device_ip,
            door_event_type=event_type,
            employee_name=parsed["employee_name"] or str(parsed["card_id"] or ""),
            event_timestamp=parsed["timestamp"],
            card_id=str(parsed["card_id"]) if parsed["card_id"] else None,
            serial_no=str(parsed["serial_no"]) if parsed["serial_no"] else None,
            picture_path=None,
            raw_payload=raw_event,
        )
        self.processor.mark_seen(event_key)
        if result.created_id:
            self.stats["total_events_processed"] += 1
            logger.info(f"💾 Event saved with ID: {result.created_id}")
            with self.events_lock:
                self.events_history.append({
                    "timestamp": datetime.now().isoformat(),
                    "type": "PROCESSED",
                    "event_id": result.created_id,
                    "employee_name": result.employee_name or parsed["employee_name"],
                    "card_id": parsed["card_id"],
                    "device_ip": device_ip,
                    "door_id": door_id,
                })
            self._download_and_attach_picture(client, result.created_id, device_ip, parsed)
        else:
            self.stats["total_events_skipped"] += 1
            logger.warning(
                "Attendance event skipped: outcome=%s employee=%s card=%s device=%s",
                result.outcome,
                parsed["employee_name"],
                parsed["card_id"],
                device_ip,
            )
            with self.events_lock:
                self.events_history.append({
                    "timestamp": datetime.now().isoformat(),
                    "type": "SKIPPED",
                    "employee_name": parsed["employee_name"],
                    "card_id": parsed["card_id"],
                    "device_ip": device_ip,
                    "door_id": door_id,
                    "reason": result.outcome,
                })

    def _download_and_attach_picture(self, client, event_id: str, device_ip: str, parsed: dict):
        if not parsed["picture_url"]:
            logger.debug(f"📷 No picture URL for event {event_id}")
            return
        
        logger.info(f"🖼️  Downloading picture for event {event_id}")
        safe_name = (
            f"{device_ip.replace('.', '_')}_{parsed['serial_no']}_{parsed['timestamp']}"
            .replace(":", "")
            .replace("+", "")
        )[:180] + ".jpg"
        picture_path = download_face_image(
            parsed["picture_url"],
            client.auth,
            self.settings["pictures_dir"],
            safe_name,
        )
        if picture_path:
            logger.info(f"✅ Picture saved: {picture_path}")
            attach_attendance_picture(event_id, picture_path)
        else:
            logger.warning(f"⚠️  Failed to download picture for event {event_id}")
