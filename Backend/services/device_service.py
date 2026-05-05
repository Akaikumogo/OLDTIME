import json
import logging
import os
from datetime import datetime
from zoneinfo import ZoneInfo

import psycopg2

from db import get_connection

logger = logging.getLogger(__name__)


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
    return cur.fetchone()


def create_employee_from_device(cur, employee_name: str):
    clean_name = (employee_name or "").strip()
    if not clean_name:
        return None

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
        cur.execute(
            """
            WITH existing AS (
                SELECT id, full_name
                FROM employees
                WHERE LOWER(TRIM(full_name)) = LOWER(TRIM(%s))
                  AND is_active = TRUE
                LIMIT 1
            ),
            inserted AS (
                INSERT INTO employees (
                    full_name,
                    department_id,
                    position_id,
                    is_active
                )
                SELECT %s, %s, %s, TRUE
                WHERE NOT EXISTS (SELECT 1 FROM existing)
                RETURNING id, full_name
            )
            SELECT id, full_name FROM inserted
            UNION ALL
            SELECT id, full_name FROM existing
            LIMIT 1
            """,
            (clean_name, clean_name, department_id, position_id),
        )
        result = cur.fetchone()
        logger.info("New employee created from Hikvision event: %s", clean_name)
        return result
    except Exception as exc:
        logger.error("Failed to create employee from Hikvision event %s: %s", clean_name, exc)
        return None


def parse_datetime_input(value: str) -> datetime:
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%d.%m.%Y %H:%M:%S"):
        try:
            return _to_app_timezone(datetime.strptime(value, fmt))
        except ValueError:
            continue
    return _to_app_timezone(datetime.fromisoformat(value))


def _to_app_timezone(value: datetime) -> datetime:
    app_tz = ZoneInfo(os.getenv("WORKPLUS_TIMEZONE", "Asia/Tashkent"))
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
