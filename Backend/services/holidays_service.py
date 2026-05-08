"""Holidays va weekend logikasi."""
from __future__ import annotations

from datetime import date
from typing import Optional

from db import get_connection
from services.app_config import get_config_value


def get_weekend_days() -> set[str]:
    raw = get_config_value("WEEKEND_DAYS", "sat,sun") or "sat,sun"
    return {item.strip().lower() for item in raw.split(",") if item.strip()}


def is_holiday(day: date) -> Optional[dict]:
    """Berilgan kun bayrammi tekshiradi. Bayram bo'lsa, dictionary qaytaradi."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, holiday_date, name, holiday_type, is_paid
                FROM holidays
                WHERE holiday_date = %s
                LIMIT 1
                """,
                (day,),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {
        "id": str(row[0]),
        "date": str(row[1]),
        "name": row[2],
        "type": row[3],
        "is_paid": row[4],
    }


def list_holidays_in_range(start: date, end: date) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, holiday_date, name, holiday_type, is_paid
                FROM holidays
                WHERE holiday_date BETWEEN %s AND %s
                ORDER BY holiday_date ASC
                """,
                (start, end),
            )
            rows = cur.fetchall()
    return [
        {
            "id": str(row[0]),
            "date": str(row[1]),
            "name": row[2],
            "type": row[3],
            "is_paid": row[4],
        }
        for row in rows
    ]
