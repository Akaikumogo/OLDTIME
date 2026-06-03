import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import psycopg2

from db import get_connection

logger = logging.getLogger(__name__)
TASHKENT_TZ = timezone(timedelta(hours=5), name="Asia/Tashkent")


def fetch_active_doors():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, name, ip_address, event_type, is_active, created_at
                    FROM doors
                    WHERE is_active = TRUE
                    ORDER BY created_at ASC
                    """
                )
                return cur.fetchall()
    except psycopg2.errors.UndefinedTable:
        logger.warning("doors table does not exist yet; Hikvision polling is waiting for DB migration")
        return []


def get_active_door_count():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM doors WHERE is_active = TRUE")
                return cur.fetchone()[0]
    except psycopg2.errors.UndefinedTable:
        return 0


def fetch_attendance_policy(cur):
    cur.execute(
        """
        SELECT
            id,
            work_start_time,
            work_end_time,
            lunch_start_time,
            lunch_end_time,
            late_grace_minutes,
            early_leave_grace_minutes,
            is_active,
            created_at,
            updated_at
        FROM attendance_policies
        WHERE is_active = TRUE
        ORDER BY updated_at DESC
        LIMIT 1
        """
    )
    return cur.fetchone()


def find_employee_matches(cur, employee_name: str):
    cur.execute(
        """
        SELECT id, full_name
        FROM employees
        WHERE is_active = TRUE AND LOWER(TRIM(full_name)) = LOWER(TRIM(%s))
        ORDER BY created_at ASC
        """,
        (employee_name,),
    )
    return cur.fetchall()


def find_employee_by_card_id(cur, card_id: str):
    """
    Card identifikator orqali xodimni topadi. Tartib:
    1. employee_device_mappings (eski model — bir xodimga bir nechta karta)
    2. employees.employee_code (yangi model — to'g'ridan-to'g'ri tabel raqami)
    """
    cur.execute(
        """
        SELECT e.id, e.full_name
        FROM employees e
        INNER JOIN employee_device_mappings edm ON e.id = edm.employee_id
        WHERE edm.card_id = %s AND edm.is_active = TRUE AND e.is_active = TRUE
        ORDER BY edm.created_at DESC
        LIMIT 1
        """,
        (card_id,),
    )
    row = cur.fetchone()
    if row:
        return row

    # Fallback: employee_code (agar mappings bo'sh bo'lsa)
    try:
        cur.execute(
            """
            SELECT id, full_name
            FROM employees
            WHERE employee_code = %s AND is_active = TRUE
            LIMIT 1
            """,
            (card_id,),
        )
        return cur.fetchone()
    except Exception:
        # employee_code ustuni hali yaratilmagan bo'lishi mumkin (eski DB)
        return None


def create_employee_from_device(cur, employee_name: str, card_id: Optional[str] = None):
    """
    Hikvision'dan kelgan event asosida xodim yaratadi.

    Smart logika:
    - "Auto Imported" department va "Unknown" position avtomatik yaratiladi
    - Agar card_id berilgan bo'lsa, u employee_code'ga yoziladi.
      Shunda keyingi marta o'sha karta o'qilganida xodim avtomatik topiladi
      (employee_code orqali). Yana auto-create kerak bo'lmaydi.
    - Bir xil ismda xodim allaqachon bor bo'lsa (active), uni qaytaradi va
      kerak bo'lsa employee_code'ni o'rnatib qo'yadi.
    """
    from psycopg2.errors import UniqueViolation

    clean_name = (employee_name or "").strip()
    if not clean_name:
        return None
    code = (card_id or "").strip() or None

    try:
        cur.execute(
            """
            INSERT INTO departments (name)
            VALUES ('Auto Imported')
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """
        )
        department_id = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO positions (name)
            VALUES ('Unknown')
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
            """
        )
        position_id = cur.fetchone()[0]

        # Avval mavjud xodimni qidir (ism yoki kod bo'yicha)
        if code:
            cur.execute(
                "SELECT id, full_name FROM employees WHERE employee_code = %s",
                (code,),
            )
            existing = cur.fetchone()
            if existing:
                return existing

        cur.execute(
            """
            SELECT id, full_name, employee_code
            FROM employees
            WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(%s))
              AND is_active = TRUE
            LIMIT 1
            """,
            (clean_name,),
        )
        existing = cur.fetchone()
        if existing:
            # Bor xodimga code biriktirib qo'yamiz, agar kelmagan bo'lsa
            if code and not existing[2]:
                try:
                    cur.execute(
                        "UPDATE employees SET employee_code = %s WHERE id = %s",
                        (code, existing[0]),
                    )
                except UniqueViolation:
                    pass
            return existing[0], existing[1]

        # Yangi xodim yaratish
        try:
            cur.execute(
                """
                INSERT INTO employees (
                    full_name, employee_code, department_id, position_id, is_active
                )
                VALUES (%s, %s, %s, %s, TRUE)
                RETURNING id, full_name
                """,
                (clean_name, code, department_id, position_id),
            )
            result = cur.fetchone()
            logger.info(
                "New employee auto-created from Hikvision event: name=%s code=%s",
                clean_name, code,
            )
            return result
        except UniqueViolation:
            # Race condition: parallel insert allaqachon yaratdi
            cur.execute(
                "SELECT id, full_name FROM employees WHERE employee_code = %s OR LOWER(TRIM(full_name)) = LOWER(TRIM(%s)) LIMIT 1",
                (code, clean_name),
            )
            return cur.fetchone()
    except Exception as exc:
        logger.error(
            "Failed to auto-create employee (name=%s, code=%s): %s",
            clean_name, code, exc,
        )
        return None


def parse_datetime_input(value: str) -> datetime:
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%d.%m.%Y %H:%M:%S"):
        try:
            return _to_app_timezone(datetime.strptime(value, fmt))
        except ValueError:
            continue
    return _to_app_timezone(datetime.fromisoformat(value))


def _to_app_timezone(value: datetime) -> datetime:
    timezone_name = os.getenv("WORKPLUS_TIMEZONE", "Asia/Tashkent")
    try:
        app_tz = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        if timezone_name != "Asia/Tashkent":
            raise
        app_tz = TASHKENT_TZ
    if value.tzinfo is None:
        return value
    return value.astimezone(app_tz).replace(tzinfo=None)


def read_hikvision_settings():
    return {
        "enabled": os.getenv("HIKVISION_POLLING_ENABLED", "true").lower() == "true",
        "username": os.getenv("HIKVISION_USERNAME", ""),
        "password": os.getenv("HIKVISION_PASSWORD", ""),
        "scheme": os.getenv("HIKVISION_SCHEME", "http").lower(),
        "port": int(os.getenv("HIKVISION_HTTP_PORT", "80")),
        "poll_interval": int(os.getenv("HIKVISION_POLL_INTERVAL_SECONDS", "5")),
        "max_results": int(os.getenv("HIKVISION_MAX_RESULTS", "10")),
        "pictures_dir": os.getenv("HIKVISION_PICTURES_DIR", "face_captures"),
        "raw_log_file": os.getenv("HIKVISION_RAW_LOG_FILE", "raw_events.jsonl"),
    }


def append_raw_log(file_path: str, payload: dict):
    with open(file_path, "a", encoding="utf-8") as file_handle:
        file_handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def serialize_door(row, health: dict | None = None):
    health = health or {}
    return {
        "id": str(row[0]),
        "name": row[1],
        "ip_address": row[2],
        "event_type": row[3],
        "is_active": row[4],
        "created_at": str(row[5]),
        "connection_status": health.get("status", "unknown"),
        "last_checked_at": health.get("last_checked_at"),
        "last_success_at": health.get("last_success_at"),
        "last_error": health.get("last_error"),
    }


def serialize_policy(row):
    return {
        "id": row[0],
        "work_start_time": str(row[1])[:5],
        "work_end_time": str(row[2])[:5],
        "lunch_start_time": str(row[3])[:5] if row[3] else None,
        "lunch_end_time": str(row[4])[:5] if row[4] else None,
        "late_grace_minutes": row[5],
        "early_leave_grace_minutes": row[6],
        "is_active": row[7],
        "created_at": str(row[8]),
        "updated_at": str(row[9]),
    }
