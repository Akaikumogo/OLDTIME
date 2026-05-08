"""DB'da saqlanadigan key-value config bilan ishlash."""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

import psycopg2

from db import get_connection


def _read_value(key: str) -> Optional[str]:
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT value FROM app_config WHERE key = %s", (key,))
                row = cur.fetchone()
        return row[0] if row else None
    except psycopg2.errors.UndefinedTable:
        return None
    except Exception:
        return None


def get_config_value(key: str, default: Optional[str] = None) -> Optional[str]:
    value = _read_value(key)
    if value is None or value == "":
        return default
    return value


def get_config_bool(key: str, default: bool = False) -> bool:
    value = get_config_value(key)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def get_config_int(key: str, default: int = 0) -> int:
    value = get_config_value(key)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def set_config_value(key: str, value: str, description: Optional[str] = None, updated_by: Optional[str] = None) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO app_config (key, value, description, updated_by, updated_at)
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT (key) DO UPDATE SET
                    value = EXCLUDED.value,
                    description = COALESCE(EXCLUDED.description, app_config.description),
                    updated_by = EXCLUDED.updated_by,
                    updated_at = NOW()
                """,
                (key, value, description, updated_by),
            )
            conn.commit()


def list_all_config() -> list[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT key, value, description, updated_at, updated_by
                FROM app_config
                ORDER BY key ASC
                """
            )
            rows = cur.fetchall()
    return [
        {
            "key": row[0],
            "value": row[1],
            "description": row[2],
            "updated_at": str(row[3]) if row[3] else None,
            "updated_by": str(row[4]) if row[4] else None,
        }
        for row in rows
    ]
