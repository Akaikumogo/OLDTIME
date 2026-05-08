"""Audit log: attendance event'lar uchun kim qachon nima qildi."""
from __future__ import annotations

import json
from typing import Any, Optional

from db import get_connection


def write_audit(
    event_id: str,
    action: str,
    changed_by: str,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
) -> None:
    """
    action: 'created' | 'updated' | 'deleted'
    """
    if action not in ("created", "updated", "deleted"):
        raise ValueError(f"Invalid audit action: {action}")
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO attendance_event_audit_logs
                    (event_id, action, changed_by, old_values, new_values)
                VALUES (%s, %s, %s, %s::jsonb, %s::jsonb)
                """,
                (
                    event_id,
                    action,
                    changed_by,
                    json.dumps(old_values, default=str) if old_values is not None else None,
                    json.dumps(new_values, default=str) if new_values is not None else None,
                ),
            )
            conn.commit()


def list_audit_for_event(event_id: str) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    al.id, al.event_id, al.action,
                    al.changed_by, a.full_name, a.username,
                    al.old_values, al.new_values, al.changed_at
                FROM attendance_event_audit_logs al
                LEFT JOIN admins a ON a.id = al.changed_by
                WHERE al.event_id = %s
                ORDER BY al.changed_at DESC
                """,
                (event_id,),
            )
            rows = cur.fetchall()
    return [
        {
            "id": str(row[0]),
            "event_id": str(row[1]),
            "action": row[2],
            "changed_by": {
                "id": str(row[3]) if row[3] else None,
                "full_name": row[4],
                "username": row[5],
            },
            "old_values": row[6],
            "new_values": row[7],
            "changed_at": str(row[8]),
        }
        for row in rows
    ]


def list_audit_recent(limit: int = 100, action: Optional[str] = None) -> list[dict]:
    filters = []
    params: list[Any] = []
    if action:
        filters.append("al.action = %s")
        params.append(action)
    where = f" WHERE {' AND '.join(filters)}" if filters else ""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    al.id, al.event_id, al.action,
                    al.changed_by, a.full_name, a.username,
                    al.old_values, al.new_values, al.changed_at
                FROM attendance_event_audit_logs al
                LEFT JOIN admins a ON a.id = al.changed_by
                {where}
                ORDER BY al.changed_at DESC
                LIMIT %s
                """,
                params + [limit],
            )
            rows = cur.fetchall()
    return [
        {
            "id": str(row[0]),
            "event_id": str(row[1]),
            "action": row[2],
            "changed_by": {
                "id": str(row[3]) if row[3] else None,
                "full_name": row[4],
                "username": row[5],
            },
            "old_values": row[6],
            "new_values": row[7],
            "changed_at": str(row[8]),
        }
        for row in rows
    ]
