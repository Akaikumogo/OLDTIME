from datetime import timedelta
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from db import get_connection
from schemas.attendance import (
    AttendanceDailyListResponse,
    AttendanceEventCreate,
    AttendanceEventEnvelope,
    AttendanceEventListResponse,
    AttendanceEventResponse,
    AttendanceEventUpdate,
    AttendancePolicyEnvelope,
    AttendancePolicyGetResponse,
    AttendancePolicyResponse,
    AttendancePolicyUpsert,
    ComputerTimelineActivity,
    DoorCreate,
    DoorEnvelope,
    DoorListResponse,
    DoorResponse,
    DoorUpdate,
    EmployeeTimelineResponse,
    EmployeeTimelineSummary,
    HikvisionPollerStatusResponse,
    ReportSummaryResponse,
    WorkPermissionCreate,
    WorkPermissionEnvelope,
    WorkPermissionListResponse,
    WorkPermissionResponse,
    WorkPermissionUpdate,
)
from schemas.common import MessageResponse
from services.device_service import parse_datetime_input, serialize_door, serialize_policy
from services.event_service import (
    parse_date_only,
    parse_filter_date,
    parse_time_only,
    persist_attendance_event_detailed,
    serialize_attendance_event,
)
from utils.auth import require_role

router = APIRouter(tags=["Attendance"])

ALLOWED_DOOR_SORT_FIELDS = {
    "name": "name",
    "ip_address": "ip_address",
    "event_type": "event_type",
    "created_at": "created_at",
}
ALLOWED_ATTENDANCE_SORT_FIELDS = {
    "event_timestamp": "ae.event_timestamp",
    "created_at": "ae.created_at",
    "employee_name": "ae.employee_name",
    "status": "ae.status",
}
ALLOWED_SORT_ORDERS = {"asc", "desc"}


def _time_to_minutes(value: str) -> int:
    hours, minutes = value.split(":")[:2]
    return int(hours) * 60 + int(minutes)


def _attendance_select():
    return """
        SELECT
            ae.id,
            ae.card_id,
            ae.serial_no,
            ae.event_timestamp,
            ae.status,
            ae.match_status,
            ae.picture_path,
            ae.created_at,
            ae.employee_id,
            ae.employee_name,
            d.id,
            d.name,
            d.ip_address,
            d.event_type
        FROM attendance_events ae
        JOIN doors d ON d.id = ae.door_id
    """


def _permission_select():
    return """
        SELECT
            wp.id,
            wp.permission_date,
            wp.start_time,
            wp.end_time,
            wp.reason,
            wp.permission_type,
            wp.status,
            wp.created_at,
            e.id,
            e.full_name
        FROM work_permissions wp
        JOIN employees e ON e.id = wp.employee_id
    """


def _serialize_permission(row):
    return {
        "id": str(row[0]),
        "permission_date": str(row[1]),
        "start_time": str(row[2])[:5],
        "end_time": str(row[3])[:5],
        "reason": row[4],
        "permission_type": row[5],
        "status": row[6],
        "created_at": str(row[7]),
        "employee": {
            "id": str(row[8]),
            "full_name": row[9],
        },
    }


def _marker_color(status_value: str, event_type: str):
    if status_value in {"late", "early_exit", "unmatched_employee", "ambiguous_employee"}:
        return "red"
    if event_type == "entry":
        return "green"
    return "green" if status_value == "on_time_exit" else "red"


def _time_label(value):
    return str(value.time())[:5]


def _time_full(value):
    return str(value.time())[:8]


def _build_daily_segments(events):
    segments = []
    open_entry = None
    for event_time, _status, event_type, _door_name in events:
        if event_type == "entry":
            open_entry = event_time
        elif event_type == "exit" and open_entry is not None:
            segments.append(
                {
                    "type": "work",
                    "label": "Ish joyida",
                    "start": _time_label(open_entry),
                    "end": _time_label(event_time),
                    "start_full": _time_full(open_entry),
                    "end_full": _time_full(event_time),
                    "color": "green",
                }
            )
            open_entry = None
    return segments


def _serialize_permission_segment(row):
    start_time, end_time, reason, permission_type = row
    return {
        "type": "permission",
        "label": permission_type,
        "start": str(start_time)[:5],
        "end": str(end_time)[:5],
        "start_full": str(start_time)[:8],
        "end_full": str(end_time)[:8],
        "color": "gray",
        "reason": reason,
    }


def _short_domain(value: str | None) -> str:
    if not value:
        return "-"
    parsed = urlparse(value)
    host = parsed.netloc or value
    host = host.split("@", 1)[0]
    host = host.split(":", 1)[0]
    parts = host.split(".")
    if len(parts) >= 3:
        return ".".join(parts[-3:])
    return host


def _computer_activity_style(app_name: str | None, url_value: str | None) -> tuple[str, str]:
    lowered = f"{app_name or ''} {url_value or ''}".lower()
    if any(token in lowered for token in ("youtube", "instagram", "tiktok", "facebook")):
        return "rose", "social"
    if any(token in lowered for token in ("code", "figma", "excel", "postgres", "pycharm", "vscode")):
        return "emerald", "work"
    if any(token in lowered for token in ("chrome", "safari", "edge", "firefox")):
        return "sky", "browser"
    return "slate", "neutral"


def _serialize_daily_attendance_row(group_row, events, permissions=None, computer_rows=None):
    employee_id, employee_name, report_date, first_entry, last_exit, statuses = group_row
    clean_statuses = [status for status in (statuses or []) if status]
    markers = [
        {
            "type": event_type,
            "label": "Kirish" if event_type == "entry" else "Chiqish",
            "time": _time_label(event_time),
            "full_time": _time_full(event_time),
            "status": event_status,
            "color": _marker_color(event_status, event_type),
            "door_name": door_name,
        }
        for event_time, event_status, event_type, door_name in events
    ]
    computer_activity = []
    top_apps: dict[str, int] = {}
    top_sites: dict[str, int] = {}
    computer_seconds = 0
    for row in computer_rows or []:
        computer_seconds += int(row[6] or 0)
        app_name = row[1] or "Unknown"
        url_value = row[3] or ""
        top_apps[app_name] = top_apps.get(app_name, 0) + int(row[6] or 0)
        site_key = _short_domain(url_value)
        top_sites[site_key] = top_sites.get(site_key, 0) + int(row[6] or 0)
        color, category = _computer_activity_style(app_name, url_value)
        computer_activity.append(
            {
                "id": str(row[0]),
                "app_name": app_name,
                "window_title": row[2],
                "url": row[3],
                "started_at": row[4].isoformat(),
                "ended_at": row[5].isoformat(),
                "duration_seconds": int(row[6] or 0),
                "color": color,
                "category": category,
            }
        )

    return {
        "id": f"{employee_id}:{report_date}",
        "date": str(report_date),
        "employee": {
            "id": str(employee_id),
            "full_name": employee_name,
        },
        "first_entry": _time_label(first_entry) if first_entry else None,
        "first_entry_full": _time_full(first_entry) if first_entry else None,
        "last_exit": _time_label(last_exit) if last_exit else None,
        "last_exit_full": _time_full(last_exit) if last_exit else None,
        "statuses": clean_statuses,
        "markers": markers,
        "segments": [
            *_build_daily_segments(events),
            *[_serialize_permission_segment(row) for row in (permissions or [])],
        ],
        "computer_activity_count": len(computer_activity),
        "computer_seconds": computer_seconds,
        "top_apps": [
            name
            for name, _seconds in sorted(top_apps.items(), key=lambda item: item[1], reverse=True)[:3]
        ],
        "top_sites": [
            name
            for name, _seconds in sorted(top_sites.items(), key=lambda item: item[1], reverse=True)[:3]
        ],
    }


@router.post("/doors", response_model=DoorEnvelope, status_code=status.HTTP_201_CREATED, summary="Create door")
def create_door(data: DoorCreate, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM doors WHERE ip_address = %s", (data.ip_address,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Door with this IP already exists")
            cur.execute(
                """
                INSERT INTO doors (name, ip_address, event_type, is_active)
                VALUES (%s, %s, %s, %s)
                RETURNING id, name, ip_address, event_type, is_active, created_at
                """,
                (data.name, data.ip_address, data.event_type, data.is_active),
            )
            row = cur.fetchone()
            conn.commit()
    return {"message": "door created", "data": serialize_door(row)}


@router.get("/doors", response_model=DoorListResponse, summary="List doors")
def list_doors(
    request: Request,
    page: int = Query(..., ge=1),
    limit: int = Query(..., ge=1, le=100),
    name: str | None = None,
    ip_address: str | None = None,
    event_type: str | None = None,
    is_active: bool | None = None,
    sort: str = Query("created_at"),
    order: str = Query("desc"),
    user=Depends(require_role(["admin", "hr"])),
):
    sort_column = ALLOWED_DOOR_SORT_FIELDS.get(sort)
    sort_order = order.lower()
    if not sort_column:
        raise HTTPException(status_code=400, detail="Invalid sort field")
    if sort_order not in ALLOWED_SORT_ORDERS:
        raise HTTPException(status_code=400, detail="Invalid sort order")

    filters = []
    params = []
    if name:
        filters.append("LOWER(name) LIKE LOWER(%s)")
        params.append(f"%{name}%")
    if ip_address:
        filters.append("ip_address = %s")
        params.append(ip_address)
    if event_type:
        filters.append("event_type = %s")
        params.append(event_type)
    if is_active is not None:
        filters.append("is_active = %s")
        params.append(is_active)

    where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
    offset = (page - 1) * limit

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM doors{where_clause}", params)
            total = cur.fetchone()[0]
            cur.execute(
                f"""
                SELECT id, name, ip_address, event_type, is_active, created_at
                FROM doors
                {where_clause}
                ORDER BY {sort_column} {sort_order.upper()}
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            rows = cur.fetchall()

    engine = getattr(request.app.state, "hikvision_engine", None)
    return {
        "meta": {"page": page, "limit": limit, "total": total},
        "data": [
            serialize_door(row, engine.get_device_health(row[2]) if engine else None)
            for row in rows
        ],
    }


@router.get("/doors/{door_id}", response_model=DoorResponse, summary="Get door")
def get_door(door_id: str, request: Request, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, ip_address, event_type, is_active, created_at
                FROM doors
                WHERE id = %s
                """,
                (door_id,),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Door not found")
    engine = getattr(request.app.state, "hikvision_engine", None)
    return serialize_door(row, engine.get_device_health(row[2]) if engine else None)


@router.patch("/doors/{door_id}", response_model=DoorEnvelope, summary="Update door")
def update_door(door_id: str, data: DoorUpdate, user=Depends(require_role(["admin", "hr"]))):
    update_fields = []
    values = []
    if data.name is not None:
        update_fields.append("name = %s")
        values.append(data.name)
    if data.ip_address is not None:
        update_fields.append("ip_address = %s")
        values.append(data.ip_address)
    if data.event_type is not None:
        update_fields.append("event_type = %s")
        values.append(data.event_type)
    if data.is_active is not None:
        update_fields.append("is_active = %s")
        values.append(data.is_active)
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nothing to update")

    with get_connection() as conn:
        with conn.cursor() as cur:
            if data.ip_address is not None:
                cur.execute(
                    "SELECT 1 FROM doors WHERE ip_address = %s AND id <> %s",
                    (data.ip_address, door_id),
                )
                if cur.fetchone():
                    raise HTTPException(status_code=409, detail="Door with this IP already exists")

            values.append(door_id)
            cur.execute(
                f"""
                UPDATE doors
                SET {", ".join(update_fields)}
                WHERE id = %s
                RETURNING id, name, ip_address, event_type, is_active, created_at
                """,
                values,
            )
            row = cur.fetchone()
            conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Door not found")
    return {"message": "door updated", "data": serialize_door(row)}


@router.delete("/doors/{door_id}", response_model=MessageResponse, summary="Delete door")
def delete_door(door_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM doors WHERE id = %s RETURNING id", (door_id,))
            deleted = cur.fetchone()
            conn.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Door not found")
    return {"message": "door deleted"}


@router.put("/attendance-policy", response_model=AttendancePolicyEnvelope, summary="Upsert attendance policy")
def upsert_policy(data: AttendancePolicyUpsert, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            if data.is_active:
                cur.execute("UPDATE attendance_policies SET is_active = FALSE")
            cur.execute(
                """
                INSERT INTO attendance_policies (
                    work_start_time,
                    work_end_time,
                    lunch_start_time,
                    lunch_end_time,
                    late_grace_minutes,
                    early_leave_grace_minutes,
                    is_active
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING
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
                """,
                (
                    data.work_start_time,
                    data.work_end_time,
                    data.lunch_start_time,
                    data.lunch_end_time,
                    data.late_grace_minutes,
                    data.early_leave_grace_minutes,
                    data.is_active,
                ),
            )
            row = cur.fetchone()
            conn.commit()
    return {"message": "attendance policy saved", "data": serialize_policy(row)}


@router.get("/attendance-policy", response_model=AttendancePolicyGetResponse, summary="Get active attendance policy")
def get_policy(user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
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
            row = cur.fetchone()
    if not row:
        return {"data": None}
    return {"data": serialize_policy(row)}


@router.post("/attendance-events", response_model=AttendanceEventEnvelope, status_code=status.HTTP_201_CREATED, summary="Create attendance event")
def create_attendance_event(data: AttendanceEventCreate, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, ip_address, event_type FROM doors WHERE id = %s", (data.door_id,))
            door = cur.fetchone()
    if not door:
        raise HTTPException(status_code=404, detail="Door not found")

    result = persist_attendance_event_detailed(
        door_id=str(door[0]),
        door_ip=door[2],
        door_event_type=door[3],
        employee_name=data.employee_name,
        event_timestamp=data.event_timestamp,
        card_id=data.card_id,
        serial_no=data.serial_no,
        picture_path=data.picture_path,
        raw_payload={"source": "manual"},
    )
    if result.outcome == "duplicate":
        raise HTTPException(status_code=409, detail="Duplicate attendance event")
    if not result.created_id:
        raise HTTPException(status_code=404, detail=result.outcome)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                _attendance_select() + " WHERE ae.id = %s",
                (result.created_id,),
            )
            row = cur.fetchone()
    return {"message": "attendance event created", "data": serialize_attendance_event(row)}


@router.get("/attendance-events", response_model=AttendanceEventListResponse, summary="List attendance events")
def list_attendance_events(
    page: int = Query(..., ge=1),
    limit: int = Query(..., ge=1, le=200),
    employee_id: str | None = None,
    employee_name: str | None = None,
    door_id: str | None = None,
    event_type: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    date_from: str | None = None,
    date_to: str | None = None,
    sort: str = Query("event_timestamp"),
    order: str = Query("desc"),
    user=Depends(require_role(["admin", "hr"])),
):
    sort_column = ALLOWED_ATTENDANCE_SORT_FIELDS.get(sort)
    sort_order = order.lower()
    if not sort_column:
        raise HTTPException(status_code=400, detail="Invalid sort field")
    if sort_order not in ALLOWED_SORT_ORDERS:
        raise HTTPException(status_code=400, detail="Invalid sort order")

    filters = []
    params = []
    if employee_id:
        filters.append("ae.employee_id = %s")
        params.append(employee_id)
    if employee_name:
        filters.append("LOWER(ae.employee_name) LIKE LOWER(%s)")
        params.append(f"%{employee_name}%")
    if door_id:
        filters.append("ae.door_id = %s")
        params.append(door_id)
    if event_type:
        filters.append("ae.door_event_type = %s")
        params.append(event_type)
    if status_filter:
        filters.append("ae.status = %s")
        params.append(status_filter)

    start_dt = parse_filter_date(date_from)
    end_dt = parse_filter_date(date_to, end_of_day=True)
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="date_from cannot be greater than date_to")
    if start_dt:
        filters.append("ae.event_timestamp >= %s")
        params.append(start_dt)
    if end_dt:
        filters.append("ae.event_timestamp <= %s")
        params.append(end_dt)

    where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
    offset = (page - 1) * limit

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM attendance_events ae{where_clause}", params)
            total = cur.fetchone()[0]
            cur.execute(
                _attendance_select()
                + f"""
                {where_clause}
                ORDER BY {sort_column} {sort_order.upper()}
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            rows = cur.fetchall()

    return {
        "meta": {"page": page, "limit": limit, "total": total},
        "data": [serialize_attendance_event(row) for row in rows],
    }


@router.get("/attendance-events/daily", response_model=AttendanceDailyListResponse, summary="List daily attendance rows")
def list_daily_attendance_events(
    page: int = Query(..., ge=1),
    limit: int = Query(..., ge=1, le=200),
    employee_id: str | None = None,
    employee_name: str | None = None,
    department_id: str | None = None,
    event_type: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    date_from: str | None = None,
    date_to: str | None = None,
    sort: str = Query("date"),
    order: str = Query("desc"),
    user=Depends(require_role(["admin", "hr"])),
):
    sort_order = order.lower()
    if sort_order not in ALLOWED_SORT_ORDERS:
        raise HTTPException(status_code=400, detail="Invalid sort order")

    sort_fields = {
        "date": "report_date",
        "employee_name": "employee_name",
        "first_entry": "first_entry",
        "last_exit": "last_exit",
    }
    sort_column = sort_fields.get(sort)
    if not sort_column:
        raise HTTPException(status_code=400, detail="Invalid sort field")

    filters = ["ae.employee_id IS NOT NULL", "ae.match_status = 'matched'"]
    params = []
    if employee_id:
        filters.append("ae.employee_id = %s")
        params.append(employee_id)
    if employee_name:
        filters.append("LOWER(ae.employee_name) LIKE LOWER(%s)")
        params.append(f"%{employee_name}%")
    if department_id:
        filters.append(
            "EXISTS (SELECT 1 FROM employees emp WHERE emp.id = ae.employee_id AND emp.department_id = %s)"
        )
        params.append(department_id)
    if event_type:
        filters.append("ae.door_event_type = %s")
        params.append(event_type)
    if status_filter:
        filters.append("ae.status = %s")
        params.append(status_filter)

    start_dt = parse_filter_date(date_from)
    end_dt = parse_filter_date(date_to, end_of_day=True)
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="date_from cannot be greater than date_to")
    if start_dt:
        filters.append("ae.event_timestamp >= %s")
        params.append(start_dt)
    if end_dt:
        filters.append("ae.event_timestamp <= %s")
        params.append(end_dt)

    where_clause = f"WHERE {' AND '.join(filters)}"
    offset = (page - 1) * limit

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT COUNT(*)
                FROM (
                    SELECT ae.employee_id, DATE(ae.event_timestamp)
                    FROM attendance_events ae
                    {where_clause}
                    GROUP BY ae.employee_id, DATE(ae.event_timestamp)
                ) grouped
                """,
                params,
            )
            total = cur.fetchone()[0]
            cur.execute(
                f"""
                SELECT
                    ae.employee_id,
                    ae.employee_name,
                    DATE(ae.event_timestamp) AS report_date,
                    MIN(ae.event_timestamp) FILTER (WHERE ae.door_event_type = 'entry') AS first_entry,
                    MAX(ae.event_timestamp) FILTER (WHERE ae.door_event_type = 'exit') AS last_exit,
                    ARRAY_AGG(DISTINCT ae.status) AS statuses
                FROM attendance_events ae
                {where_clause}
                GROUP BY ae.employee_id, ae.employee_name, DATE(ae.event_timestamp)
                ORDER BY {sort_column} {sort_order.upper()} NULLS LAST, employee_name ASC
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            groups = cur.fetchall()

            rows = []
            for group in groups:
                employee_id_value, _employee_name, report_date, *_rest = group
                cur.execute(
                    """
                    SELECT
                        ae.event_timestamp,
                        ae.status,
                        ae.door_event_type,
                        d.name
                    FROM attendance_events ae
                    JOIN doors d ON d.id = ae.door_id
                    WHERE ae.employee_id = %s
                      AND DATE(ae.event_timestamp) = %s
                      AND ae.match_status = 'matched'
                    ORDER BY ae.event_timestamp ASC
                    """,
                    (employee_id_value, report_date),
                )
                events = cur.fetchall()
                cur.execute(
                    """
                    SELECT start_time, end_time, reason, permission_type
                    FROM work_permissions
                    WHERE employee_id = %s
                      AND permission_date = %s
                      AND status = 'approved'
                    ORDER BY start_time ASC
                    """,
                    (employee_id_value, report_date),
                )
                permissions = cur.fetchall()
                cur.execute(
                    """
                    SELECT
                        id,
                        app_name,
                        window_title,
                        url,
                        started_at,
                        ended_at,
                        duration_seconds
                    FROM computer_activity_events
                    WHERE employee_id = %s
                      AND started_at >= %s
                      AND started_at < %s
                    ORDER BY started_at ASC
                    """,
                    (employee_id_value, report_date, report_date + timedelta(days=1)),
                )
                computer_rows = cur.fetchall()
                rows.append(
                    _serialize_daily_attendance_row(
                        group, events, permissions, computer_rows
                    )
                )

    return {
        "meta": {"page": page, "limit": limit, "total": total},
        "data": rows,
    }


@router.get("/attendance-events/{event_id}", response_model=AttendanceEventResponse, summary="Get attendance event")
def get_attendance_event(event_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(_attendance_select() + " WHERE ae.id = %s", (event_id,))
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Attendance event not found")
    return serialize_attendance_event(row)


@router.patch("/attendance-events/{event_id}", response_model=AttendanceEventEnvelope, summary="Update attendance event")
def update_attendance_event(event_id: str, data: AttendanceEventUpdate, user=Depends(require_role(["admin", "hr"]))):
    update_fields = []
    values = []

    if data.door_id is not None:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM doors WHERE id = %s", (data.door_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Door not found")
        update_fields.append("door_id = %s")
        values.append(data.door_id)
    if data.employee_name is not None:
        update_fields.append("employee_name = %s")
        values.append(data.employee_name)
    if data.card_id is not None:
        update_fields.append("card_id = %s")
        values.append(data.card_id)
    if data.picture_path is not None:
        update_fields.append("picture_path = %s")
        values.append(data.picture_path)
    if data.status is not None:
        update_fields.append("status = %s")
        values.append(data.status)
    if data.event_timestamp is not None:
        update_fields.append("event_timestamp = %s")
        values.append(parse_datetime_input(data.event_timestamp))

    if not update_fields:
        raise HTTPException(status_code=400, detail="Nothing to update")

    with get_connection() as conn:
        with conn.cursor() as cur:
            values.append(event_id)
            cur.execute(
                f"""
                UPDATE attendance_events
                SET {", ".join(update_fields)}
                WHERE id = %s
                RETURNING id
                """,
                values,
            )
            updated = cur.fetchone()
            conn.commit()

    if not updated:
        raise HTTPException(status_code=404, detail="Attendance event not found")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(_attendance_select() + " WHERE ae.id = %s", (event_id,))
            row = cur.fetchone()

    return {"message": "attendance event updated", "data": serialize_attendance_event(row)}


@router.delete("/attendance-events/{event_id}", response_model=MessageResponse, summary="Delete attendance event")
def delete_attendance_event(event_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM attendance_events WHERE id = %s RETURNING id", (event_id,))
            deleted = cur.fetchone()
            conn.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Attendance event not found")
    return {"message": "attendance event deleted"}


@router.get("/attendance-poller/status", response_model=HikvisionPollerStatusResponse, summary="Get Hikvision poller status")
def get_poller_status(request: Request, user=Depends(require_role(["admin", "hr"]))):
    engine = getattr(request.app.state, "hikvision_engine", None)
    if engine is None:
        return {"running": False, "poll_interval_seconds": 0, "active_doors": 0}
    return engine.status()


@router.get("/reports/attendance-summary", response_model=ReportSummaryResponse, summary="Get attendance summary report")
def get_attendance_summary(
    date_from: str = Query(...),
    date_to: str = Query(...),
    user=Depends(require_role(["admin", "hr"]))
):
    start_dt = parse_filter_date(date_from)
    end_dt = parse_filter_date(date_to, end_of_day=True)
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="date_from cannot be greater than date_to")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COUNT(*) as total_events,
                    COUNT(DISTINCT employee_id) as active_employees,
                    COUNT(*) FILTER (WHERE status = 'on_time') as on_time,
                    COUNT(*) FILTER (WHERE status = 'late') as late,
                    COUNT(*) FILTER (WHERE status = 'early_exit') as early_exit,
                    COUNT(*) FILTER (WHERE status = 'on_time_exit') as on_time_exit,
                    COUNT(*) FILTER (WHERE status = 'lunch_out') as lunch_out,
                    COUNT(*) FILTER (WHERE status = 'lunch_return') as lunch_return
                FROM attendance_events
                WHERE event_timestamp >= %s AND event_timestamp <= %s
                  AND match_status = 'matched'
                """,
                (start_dt, end_dt)
            )
            row = cur.fetchone()
            return {
                "total_events": row[0],
                "active_employees": row[1],
                "on_time": row[2],
                "late": row[3],
                "early_exit": row[4],
                "on_time_exit": row[5],
                "lunch_out": row[6],
                "lunch_return": row[7]
            }


@router.get("/reports/late-employees", summary="Get late employees report")
def get_late_employees_report(
    date_from: str = Query(...),
    date_to: str = Query(...),
    page: int = Query(..., ge=1),
    limit: int = Query(..., ge=1, le=100),
    user=Depends(require_role(["admin", "hr"]))
):
    start_dt = parse_filter_date(date_from)
    end_dt = parse_filter_date(date_to, end_of_day=True)
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="date_from cannot be greater than date_to")

    offset = (page - 1) * limit
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(DISTINCT ae.employee_id)
                FROM attendance_events ae
                WHERE ae.status = 'late'
                  AND ae.event_timestamp >= %s AND ae.event_timestamp <= %s
                  AND ae.match_status = 'matched'
                """,
                (start_dt, end_dt)
            )
            total = cur.fetchone()[0]
            cur.execute(
                """
                SELECT DISTINCT
                    ae.employee_id,
                    e.full_name,
                    d.name as department_name,
                    COUNT(*) FILTER (WHERE ae.status = 'late') as late_count,
                    MIN(ae.event_timestamp) as first_late
                FROM attendance_events ae
                JOIN employees e ON e.id = ae.employee_id
                LEFT JOIN departments d ON d.id = e.department_id
                WHERE ae.status = 'late'
                  AND ae.event_timestamp >= %s AND ae.event_timestamp <= %s
                  AND ae.match_status = 'matched'
                GROUP BY ae.employee_id, e.full_name, d.name
                ORDER BY late_count DESC
                LIMIT %s OFFSET %s
                """,
                (start_dt, end_dt, limit, offset)
            )
            rows = cur.fetchall()
            return {
                "meta": {"page": page, "limit": limit, "total": total},
                "data": [
                    {
                        "employee_id": str(row[0]),
                        "full_name": row[1],
                        "department": row[2],
                        "late_count": row[3],
                        "first_late": str(row[4])
                    }
                    for row in rows
                ]
            }


@router.get("/reports/early-exit-employees", summary="Get early exit employees report")
def get_early_exit_report(
    date_from: str = Query(...),
    date_to: str = Query(...),
    page: int = Query(..., ge=1),
    limit: int = Query(..., ge=1, le=100),
    user=Depends(require_role(["admin", "hr"]))
):
    start_dt = parse_filter_date(date_from)
    end_dt = parse_filter_date(date_to, end_of_day=True)
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="date_from cannot be greater than date_to")

    offset = (page - 1) * limit
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(DISTINCT ae.employee_id)
                FROM attendance_events ae
                WHERE ae.status = 'early_exit'
                  AND ae.event_timestamp >= %s AND ae.event_timestamp <= %s
                  AND ae.match_status = 'matched'
                """,
                (start_dt, end_dt)
            )
            total = cur.fetchone()[0]
            cur.execute(
                """
                SELECT DISTINCT
                    ae.employee_id,
                    e.full_name,
                    d.name as department_name,
                    COUNT(*) FILTER (WHERE ae.status = 'early_exit') as early_exit_count,
                    MAX(ae.event_timestamp) as last_early_exit
                FROM attendance_events ae
                JOIN employees e ON e.id = ae.employee_id
                LEFT JOIN departments d ON d.id = e.department_id
                WHERE ae.status = 'early_exit'
                  AND ae.event_timestamp >= %s AND ae.event_timestamp <= %s
                  AND ae.match_status = 'matched'
                GROUP BY ae.employee_id, e.full_name, d.name
                ORDER BY early_exit_count DESC
                LIMIT %s OFFSET %s
                """,
                (start_dt, end_dt, limit, offset)
            )
            rows = cur.fetchall()
            return {
                "meta": {"page": page, "limit": limit, "total": total},
                "data": [
                    {
                        "employee_id": str(row[0]),
                        "full_name": row[1],
                        "department": row[2],
                        "early_exit_count": row[3],
                        "last_early_exit": str(row[4])
                    }
                    for row in rows
                ]
            }


@router.post(
    "/work-permissions",
    response_model=WorkPermissionEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create work permission",
)
def create_work_permission(data: WorkPermissionCreate, user=Depends(require_role(["admin", "hr"]))):
    permission_date = parse_date_only(data.permission_date)
    start_time = parse_time_only(data.start_time)
    end_time = parse_time_only(data.end_time)
    if start_time >= end_time:
        raise HTTPException(status_code=400, detail="start_time must be earlier than end_time")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM employees WHERE id = %s AND is_active = TRUE", (data.employee_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Employee not found")
            cur.execute(
                """
                INSERT INTO work_permissions (
                    employee_id,
                    permission_date,
                    start_time,
                    end_time,
                    reason,
                    permission_type,
                    status,
                    approved_by
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    data.employee_id,
                    permission_date,
                    start_time,
                    end_time,
                    data.reason,
                    data.permission_type,
                    data.status,
                    user["user_id"],
                ),
            )
            permission_id = cur.fetchone()[0]
            cur.execute(_permission_select() + " WHERE wp.id = %s", (permission_id,))
            row = cur.fetchone()
            conn.commit()

    return {"message": "work permission created", "data": _serialize_permission(row)}


@router.get("/work-permissions", response_model=WorkPermissionListResponse, summary="List work permissions")
def list_work_permissions(
    page: int = Query(..., ge=1),
    limit: int = Query(..., ge=1, le=200),
    employee_id: str | None = None,
    employee_name: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    date_from: str | None = None,
    date_to: str | None = None,
    user=Depends(require_role(["admin", "hr"])),
):
    filters = []
    params = []
    if employee_id:
        filters.append("wp.employee_id = %s")
        params.append(employee_id)
    if employee_name:
        filters.append("LOWER(e.full_name) LIKE LOWER(%s)")
        params.append(f"%{employee_name}%")
    if status_filter:
        filters.append("wp.status = %s")
        params.append(status_filter)

    start_dt = parse_filter_date(date_from)
    end_dt = parse_filter_date(date_to, end_of_day=True)
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="date_from cannot be greater than date_to")
    if start_dt:
        filters.append("wp.permission_date >= %s")
        params.append(start_dt.date())
    if end_dt:
        filters.append("wp.permission_date <= %s")
        params.append(end_dt.date())

    where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
    offset = (page - 1) * limit

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT COUNT(*)
                FROM work_permissions wp
                JOIN employees e ON e.id = wp.employee_id
                {where_clause}
                """,
                params,
            )
            total = cur.fetchone()[0]
            cur.execute(
                _permission_select()
                + f"""
                {where_clause}
                ORDER BY wp.permission_date DESC, wp.start_time DESC
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            rows = cur.fetchall()

    return {
        "meta": {"page": page, "limit": limit, "total": total},
        "data": [_serialize_permission(row) for row in rows],
    }


@router.get("/work-permissions/{permission_id}", response_model=WorkPermissionResponse, summary="Get work permission")
def get_work_permission(permission_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(_permission_select() + " WHERE wp.id = %s", (permission_id,))
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Work permission not found")
    return _serialize_permission(row)


@router.patch("/work-permissions/{permission_id}", response_model=WorkPermissionEnvelope, summary="Update work permission")
def update_work_permission(permission_id: str, data: WorkPermissionUpdate, user=Depends(require_role(["admin", "hr"]))):
    update_fields = []
    values = []
    if data.permission_date is not None:
        update_fields.append("permission_date = %s")
        values.append(parse_date_only(data.permission_date))
    if data.start_time is not None:
        update_fields.append("start_time = %s")
        values.append(parse_time_only(data.start_time))
    if data.end_time is not None:
        update_fields.append("end_time = %s")
        values.append(parse_time_only(data.end_time))
    if data.reason is not None:
        update_fields.append("reason = %s")
        values.append(data.reason)
    if data.permission_type is not None:
        update_fields.append("permission_type = %s")
        values.append(data.permission_type)
    if data.status is not None:
        update_fields.append("status = %s")
        values.append(data.status)
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nothing to update")

    with get_connection() as conn:
        with conn.cursor() as cur:
            values.append(permission_id)
            cur.execute(
                f"""
                UPDATE work_permissions
                SET {", ".join(update_fields)}
                WHERE id = %s
                RETURNING id
                """,
                values,
            )
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(status_code=404, detail="Work permission not found")
            cur.execute(
                """
                SELECT start_time, end_time
                FROM work_permissions
                WHERE id = %s
                """,
                (permission_id,),
            )
            times = cur.fetchone()
            if times and times[0] >= times[1]:
                raise HTTPException(status_code=400, detail="start_time must be earlier than end_time")
            cur.execute(_permission_select() + " WHERE wp.id = %s", (permission_id,))
            row = cur.fetchone()
            conn.commit()

    return {"message": "work permission updated", "data": _serialize_permission(row)}


@router.delete("/work-permissions/{permission_id}", response_model=MessageResponse, summary="Delete work permission")
def delete_work_permission(permission_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM work_permissions WHERE id = %s RETURNING id", (permission_id,))
            deleted = cur.fetchone()
            conn.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Work permission not found")
    return {"message": "work permission deleted"}


@router.get("/reports/attendance-summary", response_model=ReportSummaryResponse, summary="Attendance report summary")
def attendance_summary_report(
    date_from: str,
    date_to: str,
    department_id: str | None = None,
    employee_id: str | None = None,
    user=Depends(require_role(["admin", "hr"])),
):
    start_dt = parse_filter_date(date_from)
    end_dt = parse_filter_date(date_to, end_of_day=True)
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="date_from cannot be greater than date_to")

    employee_filters = ["e.is_active = TRUE"]
    employee_params = []
    event_filters = ["ae.event_timestamp >= %s", "ae.event_timestamp <= %s"]
    event_params = [start_dt, end_dt]
    permission_filters = ["wp.permission_date >= %s", "wp.permission_date <= %s", "wp.status = 'approved'"]
    permission_params = [start_dt.date(), end_dt.date()]

    if department_id:
        employee_filters.append("e.department_id = %s")
        employee_params.append(department_id)
        event_filters.append("emp.department_id = %s")
        event_params.append(department_id)
        permission_filters.append("e.department_id = %s")
        permission_params.append(department_id)
    if employee_id:
        employee_filters.append("e.id = %s")
        employee_params.append(employee_id)
        event_filters.append("ae.employee_id = %s")
        event_params.append(employee_id)
        permission_filters.append("wp.employee_id = %s")
        permission_params.append(employee_id)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) FROM employees e WHERE {' AND '.join(employee_filters)}",
                employee_params,
            )
            active_employees = cur.fetchone()[0]
            cur.execute(
                f"""
                SELECT
                    COUNT(*),
                    COUNT(*) FILTER (WHERE ae.status = 'on_time'),
                    COUNT(*) FILTER (WHERE ae.status = 'late'),
                    COUNT(*) FILTER (WHERE ae.status = 'early_exit'),
                    COUNT(*) FILTER (WHERE ae.status = 'on_time_exit'),
                    COUNT(*) FILTER (WHERE ae.status = 'lunch_out'),
                    COUNT(*) FILTER (WHERE ae.status = 'lunch_return'),
                    COUNT(*) FILTER (WHERE ae.match_status = 'unmatched'),
                    COUNT(*) FILTER (WHERE ae.match_status = 'ambiguous')
                FROM attendance_events ae
                LEFT JOIN employees emp ON emp.id = ae.employee_id
                WHERE {' AND '.join(event_filters)}
                """,
                event_params,
            )
            stats = cur.fetchone()
            cur.execute(
                f"""
                SELECT COUNT(*)
                FROM work_permissions wp
                JOIN employees e ON e.id = wp.employee_id
                WHERE {' AND '.join(permission_filters)}
                """,
                permission_params,
            )
            permissions = cur.fetchone()[0]

    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_events": stats[0],
        "active_employees": active_employees,
        "on_time": stats[1],
        "late": stats[2],
        "early_exit": stats[3],
        "on_time_exit": stats[4],
        "lunch_out": stats[5],
        "lunch_return": stats[6],
        "unmatched": stats[7],
        "ambiguous": stats[8],
        "permissions": permissions,
    }


@router.get("/reports/employee-timeline", response_model=EmployeeTimelineResponse, summary="Employee day timeline")
def employee_timeline_report(
    employee_id: str,
    date: str,
    user=Depends(require_role(["admin", "hr"])),
):
    report_date = parse_date_only(date)
    next_date = report_date + timedelta(days=1)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, full_name FROM employees WHERE id = %s", (employee_id,))
            employee = cur.fetchone()
            if not employee:
                raise HTTPException(status_code=404, detail="Employee not found")

            cur.execute(
                """
                SELECT
                    ae.event_timestamp,
                    ae.status,
                    d.event_type,
                    d.name
                FROM attendance_events ae
                JOIN doors d ON d.id = ae.door_id
                WHERE ae.employee_id = %s
                  AND DATE(ae.event_timestamp) = %s
                ORDER BY ae.event_timestamp ASC
                """,
                (employee_id, report_date),
            )
            events = cur.fetchall()
            cur.execute(
                """
                SELECT start_time, end_time, reason, permission_type
                FROM work_permissions
                WHERE employee_id = %s
                  AND permission_date = %s
                  AND status = 'approved'
                ORDER BY start_time ASC
                """,
                (employee_id, report_date),
            )
            permissions = cur.fetchall()
            cur.execute(
                """
                SELECT
                    id,
                    app_name,
                    window_title,
                    url,
                    started_at,
                    ended_at,
                    duration_seconds,
                    created_at
                FROM computer_activity_events
                WHERE employee_id = %s
                  AND started_at >= %s
                  AND started_at < %s
                ORDER BY started_at ASC
                """,
                (employee_id, report_date, next_date),
            )
            computer_rows = cur.fetchall()

    segments = [
        {
            "type": "permission",
            "label": row[3],
            "start": str(row[0])[:5],
            "end": str(row[1])[:5],
            "color": "gray",
            "reason": row[2],
        }
        for row in permissions
    ]

    open_entry = None
    work_seconds = 0
    for event_time, event_status, event_type, door_name in events:
        event_time_label = str(event_time.time())[:5]
        if event_type == "entry":
            open_entry = event_time
        elif event_type == "exit" and open_entry is not None:
            work_seconds += max(int((event_time - open_entry).total_seconds()), 0)
            segments.append(
                {
                    "type": "work",
                    "label": "Ish joyida",
                    "start": str(open_entry.time())[:5],
                    "end": event_time_label,
                    "color": "green",
                    "reason": None,
                }
            )
            open_entry = None

    permission_seconds = sum(
        max(_time_to_minutes(str(row[1])[:5]) - _time_to_minutes(str(row[0])[:5]), 0) * 60
        for row in permissions
    )

    computer_activity = []
    computer_seconds = 0
    for row in computer_rows:
        computer_seconds += int(row[6] or 0)
        app_name = row[1] or "Unknown"
        url_value = row[3] or ""
        category = "neutral"
        color = "slate"
        lowered = f"{app_name} {url_value}".lower()
        if any(token in lowered for token in ("youtube", "instagram", "tiktok", "facebook")):
            category = "social"
            color = "rose"
        elif any(token in lowered for token in ("code", "figma", "excel", "postgres", "pycharm", "vscode")):
            category = "work"
            color = "emerald"
        elif any(token in lowered for token in ("chrome", "safari", "edge", "firefox")):
            category = "browser"
            color = "sky"

        computer_activity.append(
            {
                "id": str(row[0]),
                "app_name": app_name,
                "window_title": row[2],
                "url": row[3],
                "started_at": row[4].isoformat(),
                "ended_at": row[5].isoformat(),
                "duration_seconds": int(row[6] or 0),
                "color": color,
                "category": category,
            }
        )

    markers = [
        {
            "type": event_type,
            "label": "Kirish" if event_type == "entry" else "Chiqish",
            "time": str(event_time.time())[:5],
            "status": event_status,
            "color": _marker_color(event_status, event_type),
            "door_name": door_name,
        }
        for event_time, event_status, event_type, door_name in events
    ]

    first_entry = next(
        (str(event_time.time())[:5] for event_time, _event_status, event_type, _door_name in events if event_type == "entry"),
        None,
    )
    last_exit = next(
        (
            str(event_time.time())[:5]
            for event_time, _event_status, event_type, _door_name in reversed(events)
            if event_type == "exit"
        ),
        None,
    )

    summary = {
        "first_entry": first_entry,
        "last_exit": last_exit,
        "attendance_event_count": len(events),
        "attendance_segment_count": sum(1 for segment in segments if segment["type"] == "work"),
        "permission_segment_count": len(permissions),
        "computer_activity_count": len(computer_activity),
        "work_seconds": work_seconds,
        "permission_seconds": permission_seconds,
        "computer_seconds": computer_seconds,
    }

    return {
        "employee": {
            "id": str(employee[0]),
            "full_name": employee[1],
        },
        "date": str(report_date),
        "segments": segments,
        "markers": markers,
        "computer_activity": computer_activity,
        "summary": summary,
    }
