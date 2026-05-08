from collections import OrderedDict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
import json
from typing import Optional

from fastapi import HTTPException

from db import get_connection
from services.app_config import get_config_bool
from services.attendance_status import (
    DayEvent,
    ShiftPolicy,
    StatusContext,
    resolve_status as pure_resolve_status,
)
from services.device_service import (
    fetch_attendance_policy,
    find_employee_matches,
    find_employee_by_card_id,
    parse_datetime_input,
    create_employee_from_device,
)
from services.holidays_service import is_holiday as fetch_holiday_for
from services.shifts_service import (
    fetch_shift_for_employee,
    policy_row_to_shift,
    shift_row_to_policy,
)


@dataclass
class AttendancePersistResult:
    created_id: Optional[str]
    outcome: str
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    status: Optional[str] = None
    match_status: Optional[str] = None


class EventProcessor:
    def __init__(self, max_seen_events: int = 10000):
        self.seen_events = OrderedDict()
        self.max_seen_events = max_seen_events

    def generate_event_key(self, device_ip, card_id, timestamp, serial_no):
        return f"{device_ip}:{card_id}:{timestamp}:{serial_no}"

    def is_duplicate(self, event_key):
        return event_key in self.seen_events

    def mark_seen(self, event_key):
        self.seen_events[event_key] = True
        self.seen_events.move_to_end(event_key)
        while len(self.seen_events) > self.max_seen_events:
            self.seen_events.popitem(last=False)

    def parse_event(self, raw_event):
        return {
            "card_id": raw_event.get("cardNo") or raw_event.get("employeeNoString"),
            "employee_name": (raw_event.get("name") or "").strip(),
            "timestamp": raw_event.get("time"),
            "serial_no": raw_event.get("serialNo"),
            "picture_url": raw_event.get("pictureURL"),
            "minor": raw_event.get("minor"),
        }


def parse_filter_date(value: Optional[str], end_of_day: bool = False):
    if value is None:
        return None

    for fmt in ("%d.%m.%Y", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(value, fmt)
            if end_of_day:
                return parsed.replace(hour=23, minute=59, second=59)
            return parsed.replace(hour=0, minute=0, second=0)
        except ValueError:
            continue

    raise HTTPException(status_code=400, detail="Invalid date format")


def parse_date_only(value: str) -> date:
    for fmt in ("%d.%m.%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise HTTPException(status_code=400, detail="Invalid date format")


def parse_time_only(value: str) -> time:
    normalized = value.strip()[:5]
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(value.strip(), fmt).time()
        except ValueError:
            continue
    try:
        return datetime.strptime(normalized, "%H:%M").time()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format")


def _combine(day: date, value: Optional[time], tzinfo=None):
    if value is None:
        return None
    return datetime.combine(day, value).replace(tzinfo=tzinfo)


def _compute_match(cur, employee_name: str, card_id: Optional[str] = None):
    # 1) Card ID bo'yicha match (eng ishonchli)
    if card_id:
        card_match = find_employee_by_card_id(cur, card_id)
        if card_match:
            return str(card_match[0]), card_match[1], "matched"

    # 2) Ism bo'yicha exact match
    matches = find_employee_matches(cur, employee_name)
    if len(matches) == 1:
        return str(matches[0][0]), matches[0][1], "matched"
    if len(matches) > 1:
        return None, employee_name, "ambiguous"

    # 3) Auto-create: agar yoqilgan bo'lsa (default ON), card_id employee_code'ga
    #    yoziladi — keyingi safar shu karta orqali avtomatik topiladi.
    if get_config_bool("AUTO_CREATE_EMPLOYEE_FROM_DEVICE", default=True):
        new_employee = create_employee_from_device(cur, employee_name, card_id=card_id)
        if new_employee:
            return str(new_employee[0]), new_employee[1], "matched"

    return None, employee_name, "unmatched"


def _is_within_lunch(policy_row, event_dt: datetime):
    lunch_start = _combine(event_dt.date(), policy_row[3] if policy_row else None, event_dt.tzinfo)
    lunch_end = _combine(event_dt.date(), policy_row[4] if policy_row else None, event_dt.tzinfo)
    if lunch_start is None or lunch_end is None:
        return False
    return lunch_start <= event_dt <= lunch_end


def _get_first_entry(cur, employee_id: str, day: date):
    cur.execute(
        """
        SELECT id
        FROM attendance_events
        WHERE employee_id = %s
          AND door_event_type = 'entry'
          AND DATE(event_timestamp) = %s
          AND status NOT IN ('lunch_return')
        ORDER BY event_timestamp ASC
        LIMIT 1
        """,
        (employee_id, day),
    )
    return cur.fetchone()


def _normalize_previous_exit_statuses(cur, employee_id: str, day: date):
    cur.execute(
        """
        UPDATE attendance_events
        SET status = 'exit'
        WHERE employee_id = %s
          AND door_event_type = 'exit'
          AND DATE(event_timestamp) = %s
          AND status IN ('early_exit', 'on_time_exit')
        """,
        (employee_id, day),
    )


def _build_shift_for_event(cur, employee_id: Optional[str], event_dt: datetime, policy_row) -> Optional[ShiftPolicy]:
    """
    Avval xodimga atalgan shift'ni izlaydi (employee_shifts).
    Topilmasa, global attendance_policies ishlatiladi (legacy fallback).
    """
    if employee_id:
        try:
            shift_row = fetch_shift_for_employee(cur, employee_id, event_dt.date())
        except Exception:
            shift_row = None
        if shift_row:
            return shift_row_to_policy(shift_row)
    return policy_row_to_shift(policy_row)


def _previous_day_events(cur, employee_id: Optional[str], event_dt: datetime) -> list[DayEvent]:
    if not employee_id:
        return []
    cur.execute(
        """
        SELECT event_timestamp, door_event_type
        FROM attendance_events
        WHERE employee_id = %s
          AND DATE(event_timestamp) = %s
          AND event_timestamp <= %s
        ORDER BY event_timestamp ASC
        """,
        (employee_id, event_dt.date(), event_dt),
    )
    rows = cur.fetchall()
    return [DayEvent(timestamp=row[0], door_event_type=row[1]) for row in rows]


def _resolve_status(cur, door_event_type: str, employee_id: Optional[str], match_status: str, event_dt: datetime, policy_row):
    """
    Pure status logikasini chaqiradi (services.attendance_status.resolve_status).
    DB bilan ishlash (oldingi event'larni olish, exit'larni normalize qilish) shu yerda.
    """
    # Match status muammoli bo'lsa — DB'dan qo'shimcha ma'lumotlar olishga hojat yo'q.
    if match_status in ("unmatched", "ambiguous") or not employee_id:
        ctx = StatusContext(
            door_event_type=door_event_type,
            match_status=match_status,
            event_dt=event_dt,
            shift=None,
        )
        return pure_resolve_status(ctx)

    shift = _build_shift_for_event(cur, employee_id, event_dt, policy_row)
    holiday = fetch_holiday_for(event_dt.date())
    previous = _previous_day_events(cur, employee_id, event_dt)

    ctx = StatusContext(
        door_event_type=door_event_type,
        match_status=match_status,
        event_dt=event_dt,
        shift=shift,
        is_holiday=holiday is not None,
        previous_events=previous,
    )
    new_status = pure_resolve_status(ctx)

    # Side effect: agar oxirgi 'exit' final-status bo'lsa, oldingilarini 'exit'ga normalize qilamiz.
    if new_status in ("on_time_exit", "early_exit"):
        _normalize_previous_exit_statuses(cur, employee_id, event_dt.date())

    return new_status


def persist_attendance_event(
    door_id: str,
    door_ip: str,
    door_event_type: str,
    employee_name: str,
    event_timestamp: str,
    card_id: Optional[str],
    serial_no: Optional[str],
    picture_path: Optional[str],
    raw_payload: Optional[dict],
):
    result = persist_attendance_event_detailed(
        door_id=door_id,
        door_ip=door_ip,
        door_event_type=door_event_type,
        employee_name=employee_name,
        event_timestamp=event_timestamp,
        card_id=card_id,
        serial_no=serial_no,
        picture_path=picture_path,
        raw_payload=raw_payload,
    )
    return result.created_id


def persist_attendance_event_detailed(
    door_id: str,
    door_ip: str,
    door_event_type: str,
    employee_name: str,
    event_timestamp: str,
    card_id: Optional[str],
    serial_no: Optional[str],
    picture_path: Optional[str],
    raw_payload: Optional[dict],
) -> AttendancePersistResult:
    if not event_timestamp:
        return AttendancePersistResult(created_id=None, outcome="missing_timestamp")

    clean_employee_name = (employee_name or "").strip()
    if not clean_employee_name:
        return AttendancePersistResult(created_id=None, outcome="missing_employee_name")

    event_dt = parse_datetime_input(event_timestamp)
    event_key = f"{door_ip}:{card_id or clean_employee_name}:{event_timestamp}:{serial_no}"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM doors WHERE id = %s", (door_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Door not found")

            policy_row = fetch_attendance_policy(cur)
            employee_id, normalized_name, match_status = _compute_match(cur, clean_employee_name, card_id)

            # Eventni har doim saqlaymiz — match_status NULL bo'lsa ham.
            # Bu HR'ga keyinchalik qo'lda biriktirib qo'yish imkonini beradi.
            cur.execute("SELECT id FROM attendance_events WHERE event_key = %s", (event_key,))
            duplicate = cur.fetchone()
            if duplicate:
                conn.rollback()
                return AttendancePersistResult(
                    created_id=None,
                    outcome="duplicate",
                    employee_id=employee_id,
                    employee_name=normalized_name,
                    match_status=match_status,
                )

            status = _resolve_status(
                cur,
                door_event_type,
                employee_id,
                match_status,
                event_dt,
                policy_row,
            )

            cur.execute(
                """
                INSERT INTO attendance_events (
                    door_id,
                    employee_id,
                    employee_name,
                    card_id,
                    serial_no,
                    event_timestamp,
                    door_event_type,
                    status,
                    match_status,
                    picture_path,
                    event_key,
                    raw_payload
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                ON CONFLICT (event_key) DO NOTHING
                RETURNING id
                """,
                (
                    door_id,
                    employee_id,
                    normalized_name,
                    card_id,
                    serial_no,
                    event_dt,
                    door_event_type,
                    status,
                    match_status,
                    picture_path,
                    event_key,
                    json.dumps(raw_payload or {}),
                ),
            )
            created = cur.fetchone()
            conn.commit()

    if not created:
        return AttendancePersistResult(
            created_id=None,
            outcome="duplicate",
            employee_id=employee_id,
            employee_name=normalized_name,
            status=status,
            match_status=match_status,
        )

    return AttendancePersistResult(
        created_id=str(created[0]),
        outcome="created",
        employee_id=employee_id,
        employee_name=normalized_name,
        status=status,
        match_status=match_status,
    )


def attach_attendance_picture(event_id: str, picture_path: str):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE attendance_events
                SET picture_path = %s
                WHERE id = %s
                """,
                (picture_path, event_id),
            )
            conn.commit()


def serialize_attendance_event(row):
    from services.storage_service import face_capture_url

    return {
        "id": str(row[0]),
        "card_id": row[1],
        "serial_no": row[2],
        "event_timestamp": str(row[3]),
        "status": row[4],
        "match_status": row[5],
        "picture_path": row[6],
        "picture_url": face_capture_url(row[6]),
        "created_at": str(row[7]),
        "employee": {
            "id": str(row[8]) if row[8] else None,
            "full_name": row[9],
        },
        "door": {
            "id": str(row[10]),
            "name": row[11],
            "ip_address": row[12],
            "event_type": row[13],
        },
    }
          