"""Smenalar va xodim-smena bog'lanishi."""
from __future__ import annotations

from datetime import date, time
from typing import Optional

from services.attendance_status import ShiftPolicy


def parse_time_str(value) -> time:
    if value is None:
        return None  # type: ignore
    if isinstance(value, time):
        return value
    return time.fromisoformat(str(value))


def policy_row_to_shift(policy_row) -> Optional[ShiftPolicy]:
    """attendance_policies satridan ShiftPolicy yaratadi (legacy fallback)."""
    if not policy_row:
        return None
    work_start = parse_time_str(policy_row[1])
    work_end = parse_time_str(policy_row[2])
    lunch_start = parse_time_str(policy_row[3]) if policy_row[3] else None
    lunch_end = parse_time_str(policy_row[4]) if policy_row[4] else None
    is_overnight = work_end < work_start
    return ShiftPolicy(
        work_start_time=work_start,
        work_end_time=work_end,
        lunch_start_time=lunch_start,
        lunch_end_time=lunch_end,
        late_grace_minutes=policy_row[5] or 0,
        early_leave_grace_minutes=policy_row[6] or 0,
        is_overnight=is_overnight,
        work_days=("mon", "tue", "wed", "thu", "fri"),
    )


def shift_row_to_policy(row) -> ShiftPolicy:
    """shifts jadvali satridan ShiftPolicy."""
    work_start = parse_time_str(row[2])
    work_end = parse_time_str(row[3])
    is_overnight = bool(row[4]) or work_end < work_start
    lunch_start = parse_time_str(row[5]) if row[5] else None
    lunch_end = parse_time_str(row[6]) if row[6] else None
    work_days = tuple(row[9]) if row[9] else ("mon", "tue", "wed", "thu", "fri")
    return ShiftPolicy(
        work_start_time=work_start,
        work_end_time=work_end,
        lunch_start_time=lunch_start,
        lunch_end_time=lunch_end,
        late_grace_minutes=row[7] or 0,
        early_leave_grace_minutes=row[8] or 0,
        is_overnight=is_overnight,
        work_days=work_days,
    )


def fetch_shift_for_employee(cur, employee_id: str, day: date) -> Optional[tuple]:
    """Berilgan kunda xodimga taalluqli shift'ni topadi (employee_shifts orqali)."""
    cur.execute(
        """
        SELECT s.id, s.name, s.start_time, s.end_time, s.is_overnight,
               s.lunch_start_time, s.lunch_end_time,
               s.late_grace_minutes, s.early_leave_grace_minutes,
               s.work_days
        FROM employee_shifts es
        JOIN shifts s ON s.id = es.shift_id
        WHERE es.employee_id = %s
          AND es.effective_from <= %s
          AND (es.effective_to IS NULL OR es.effective_to >= %s)
          AND s.is_active = TRUE
        ORDER BY es.effective_from DESC
        LIMIT 1
        """,
        (employee_id, day, day),
    )
    return cur.fetchone()


def serialize_shift(row) -> dict:
    return {
        "id": str(row[0]),
        "name": row[1],
        "start_time": str(row[2])[:5],
        "end_time": str(row[3])[:5],
        "is_overnight": bool(row[4]),
        "lunch_start_time": str(row[5])[:5] if row[5] else None,
        "lunch_end_time": str(row[6])[:5] if row[6] else None,
        "late_grace_minutes": row[7] or 0,
        "early_leave_grace_minutes": row[8] or 0,
        "work_days": list(row[9]) if row[9] else [],
        "is_active": bool(row[10]) if len(row) > 10 else True,
        "created_at": str(row[11]) if len(row) > 11 else "",
    }
