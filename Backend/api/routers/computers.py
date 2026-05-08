import os
from datetime import datetime, timedelta
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from db import get_connection
from schemas.common import MessageResponse
from schemas.computers import (
    ComputerActivityBatch,
    ComputerActivityListResponse,
    ComputerAnalyticsResponse,
    ComputerAssign,
    ComputerCreate,
    ComputerEnvelope,
    ComputerHeartbeat,
    ComputerListResponse,
    ComputerUpdate,
)
from services.device_service import parse_datetime_input
from services.event_service import parse_filter_date
from utils.auth import require_role

router = APIRouter(tags=["Computer Monitoring"])


def _require_agent_token(authorization: str | None = Header(None)):
    expected = os.getenv("COMPUTER_AGENT_TOKEN")
    if not expected or len(expected.encode("utf-8")) < 32:
        raise HTTPException(status_code=500, detail="COMPUTER_AGENT_TOKEN is not configured securely")
    if not authorization or authorization != f"Bearer {expected}":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid agent token")


def _serialize_computer(row):
    last_seen_at = row[8]
    connection_status = "unknown"
    if last_seen_at:
        connection_status = "online" if datetime.now() - last_seen_at <= timedelta(minutes=2) else "offline"
    employee = None
    if row[11]:
        employee = {
            "id": str(row[11]),
            "full_name": row[12],
        }
    return {
        "id": str(row[0]),
        "device_id": row[1],
        "hostname": row[2],
        "mac_address": row[3],
        "ip_address": row[4],
        "os_name": row[5],
        "agent_version": row[6],
        "is_active": row[7],
        "last_seen_at": str(last_seen_at) if last_seen_at else None,
        "created_at": str(row[9]),
        "connection_status": connection_status,
        "employee": employee,
    }


def _computer_select():
    return """
        SELECT
            c.id,
            c.device_id,
            c.hostname,
            c.mac_address,
            c.ip_address,
            c.os_name,
            c.agent_version,
            c.is_active,
            c.last_seen_at,
            c.created_at,
            c.updated_at,
            e.id,
            e.full_name
        FROM computers c
        LEFT JOIN employees e ON e.id = c.employee_id
    """


def _serialize_activity(row):
    computer = None
    if len(row) > 10 and row[10]:
        computer = {
            "id": str(row[1]),
            "hostname": row[10],
        }
    employee = None
    if len(row) > 11 and row[11]:
        employee = {
            "id": str(row[2]),
            "full_name": row[11],
        }
    return {
        "id": str(row[0]),
        "computer_id": str(row[1]),
        "employee_id": str(row[2]) if row[2] else None,
        "computer": computer,
        "employee": employee,
        "app_name": row[3],
        "window_title": row[4],
        "url": row[5],
        "started_at": str(row[6]),
        "ended_at": str(row[7]),
        "duration_seconds": row[8],
        "created_at": str(row[9]),
    }


def _site_from_url(url: str | None):
    if not url:
        return None
    parsed = urlparse(url)
    host = parsed.netloc or parsed.path.split("/")[0]
    host = host.lower().removeprefix("www.")
    return host or None


def _provided_fields(model) -> set[str]:
    return set(
        getattr(model, "model_fields_set", getattr(model, "__fields_set__", set()))
    )


def _ensure_active_employee(cur, employee_id: str | None):
    if not employee_id:
        return
    cur.execute("SELECT 1 FROM employees WHERE id = %s AND is_active = TRUE", (employee_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Employee not found")


def _find_computer_for_agent(cur, device_id: str | None, mac_address: str):
    if device_id:
        cur.execute(
            """
            SELECT id, employee_id
            FROM computers
            WHERE device_id = %s OR mac_address = %s
            ORDER BY CASE WHEN device_id = %s THEN 0 ELSE 1 END
            LIMIT 1
            """,
            (device_id, mac_address, device_id),
        )
    else:
        cur.execute(
            "SELECT id, employee_id FROM computers WHERE mac_address = %s",
            (mac_address,),
        )
    return cur.fetchone()


@router.post(
    "/internal/computers/heartbeat",
    response_model=ComputerEnvelope,
    summary="Register or update computer from desktop agent",
)
def computer_heartbeat(data: ComputerHeartbeat, _token=Depends(_require_agent_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            if data.employee_id:
                cur.execute("SELECT 1 FROM employees WHERE id = %s", (data.employee_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Employee not found")
            existing = _find_computer_for_agent(cur, data.device_id, data.mac_address)
            if existing:
                cur.execute(
                    """
                    UPDATE computers
                    SET
                        device_id = COALESCE(%s, device_id),
                        hostname = %s,
                        mac_address = %s,
                        ip_address = %s,
                        os_name = %s,
                        agent_version = %s,
                        employee_id = COALESCE(%s, employee_id),
                        is_active = TRUE,
                        last_seen_at = NOW(),
                        updated_at = NOW()
                    WHERE id = %s
                    RETURNING id
                    """,
                    (
                        data.device_id,
                        data.hostname,
                        data.mac_address,
                        data.ip_address,
                        data.os_name,
                        data.agent_version,
                        data.employee_id,
                        existing[0],
                    ),
                )
                computer_id = cur.fetchone()[0]
            else:
                cur.execute(
                    """
                    INSERT INTO computers (
                        device_id,
                        hostname,
                        mac_address,
                        ip_address,
                        os_name,
                        agent_version,
                        employee_id,
                        last_seen_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                    RETURNING id
                    """,
                    (
                        data.device_id,
                        data.hostname,
                        data.mac_address,
                        data.ip_address,
                        data.os_name,
                        data.agent_version,
                        data.employee_id,
                    ),
                )
                computer_id = cur.fetchone()[0]
            cur.execute(_computer_select() + " WHERE c.id = %s", (computer_id,))
            row = cur.fetchone()
            conn.commit()
    return {"message": "computer registered", "data": _serialize_computer(row)}


@router.post(
    "/internal/computer-activity/events",
    response_model=MessageResponse,
    summary="Store desktop activity batch from agent",
)
def create_activity_events(data: ComputerActivityBatch, _token=Depends(_require_agent_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            computer = _find_computer_for_agent(cur, data.device_id, data.mac_address)
            if not computer:
                raise HTTPException(status_code=404, detail="Computer not registered")

            event_employee_id = computer[1]
            if data.employee_id:
                cur.execute("SELECT 1 FROM employees WHERE id = %s", (data.employee_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Employee not found")
                event_employee_id = data.employee_id

            for item in data.events:
                started_at = parse_datetime_input(item.started_at)
                ended_at = parse_datetime_input(item.ended_at)
                if ended_at < started_at:
                    continue
                duration_seconds = int((ended_at - started_at).total_seconds())
                duration_seconds = max(duration_seconds, item.duration_seconds, 0)
                cur.execute(
                    """
                    SELECT 1
                    FROM computer_activity_events
                    WHERE computer_id = %s
                      AND app_name = %s
                      AND started_at = %s
                      AND ended_at = %s
                      AND COALESCE(window_title, '') = COALESCE(%s, '')
                      AND COALESCE(url, '') = COALESCE(%s, '')
                    LIMIT 1
                    """,
                    (
                        computer[0],
                        item.app_name,
                        started_at,
                        ended_at,
                        item.window_title,
                        item.url,
                    ),
                )
                if cur.fetchone():
                    continue
                cur.execute(
                    """
                    INSERT INTO computer_activity_events (
                        computer_id,
                        employee_id,
                        app_name,
                        window_title,
                        url,
                        started_at,
                        ended_at,
                        duration_seconds
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        computer[0],
                        event_employee_id,
                        item.app_name,
                        item.window_title,
                        item.url,
                        started_at,
                        ended_at,
                        duration_seconds,
                    ),
                )
            cur.execute(
                "UPDATE computers SET last_seen_at = NOW(), updated_at = NOW() WHERE id = %s",
                (computer[0],),
            )
            conn.commit()
    return {"message": "activity events stored"}


@router.get("/computers", response_model=ComputerListResponse, summary="List computers")
def list_computers(
    page: int = Query(..., ge=1),
    limit: int = Query(..., ge=1, le=100),
    employee_id: str | None = None,
    hostname: str | None = None,
    is_active: bool | None = None,
    user=Depends(require_role(["admin", "hr"])),
):
    filters = []
    params = []
    if employee_id:
        filters.append("c.employee_id = %s")
        params.append(employee_id)
    if hostname:
        filters.append("LOWER(c.hostname) LIKE LOWER(%s)")
        params.append(f"%{hostname}%")
    if is_active is not None:
        filters.append("c.is_active = %s")
        params.append(is_active)

    where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
    offset = (page - 1) * limit
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM computers c{where_clause}", params)
            total = cur.fetchone()[0]
            cur.execute(
                _computer_select()
                + f"""
                {where_clause}
                ORDER BY c.last_seen_at DESC NULLS LAST, c.created_at DESC
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            rows = cur.fetchall()
    return {
        "meta": {"page": page, "limit": limit, "total": total},
        "data": [_serialize_computer(row) for row in rows],
    }


@router.post(
    "/computers",
    response_model=ComputerEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create computer",
)
def create_computer(data: ComputerCreate, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            _ensure_active_employee(cur, data.employee_id)
            if data.device_id:
                cur.execute("SELECT 1 FROM computers WHERE device_id = %s", (data.device_id,))
                if cur.fetchone():
                    raise HTTPException(status_code=409, detail="Computer with this device ID already exists")
            cur.execute("SELECT 1 FROM computers WHERE mac_address = %s", (data.mac_address,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Computer with this MAC already exists")
            cur.execute(
                """
                INSERT INTO computers (
                    device_id,
                    hostname,
                    mac_address,
                    ip_address,
                    os_name,
                    agent_version,
                    employee_id,
                    is_active,
                    updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
                """,
                (
                    data.device_id,
                    data.hostname,
                    data.mac_address,
                    data.ip_address,
                    data.os_name,
                    data.agent_version,
                    data.employee_id,
                    data.is_active,
                ),
            )
            computer_id = cur.fetchone()[0]
            cur.execute(_computer_select() + " WHERE c.id = %s", (computer_id,))
            row = cur.fetchone()
            conn.commit()
    return {"message": "computer created", "data": _serialize_computer(row)}


@router.patch(
    "/computers/{computer_id}",
    response_model=ComputerEnvelope,
    summary="Update computer",
)
def update_computer(
    computer_id: str,
    data: ComputerUpdate,
    user=Depends(require_role(["admin", "hr"])),
):
    provided = _provided_fields(data)
    update_fields = []
    values = []

    field_map = {
        "device_id": "device_id",
        "hostname": "hostname",
        "mac_address": "mac_address",
        "ip_address": "ip_address",
        "os_name": "os_name",
        "agent_version": "agent_version",
        "employee_id": "employee_id",
        "is_active": "is_active",
    }

    for field_name, column_name in field_map.items():
        if field_name in provided:
            update_fields.append(f"{column_name} = %s")
            values.append(getattr(data, field_name))

    if not update_fields:
        raise HTTPException(status_code=400, detail="Nothing to update")

    with get_connection() as conn:
        with conn.cursor() as cur:
            if "employee_id" in provided:
                _ensure_active_employee(cur, data.employee_id)
            if data.mac_address is not None:
                cur.execute(
                    "SELECT 1 FROM computers WHERE mac_address = %s AND id <> %s",
                    (data.mac_address, computer_id),
                )
                if cur.fetchone():
                    raise HTTPException(status_code=409, detail="Computer with this MAC already exists")
            if data.device_id is not None:
                cur.execute(
                    "SELECT 1 FROM computers WHERE device_id = %s AND id <> %s",
                    (data.device_id, computer_id),
                )
                if cur.fetchone():
                    raise HTTPException(status_code=409, detail="Computer with this device ID already exists")

            values.append(computer_id)
            cur.execute(
                f"""
                UPDATE computers
                SET {", ".join(update_fields)}, updated_at = NOW()
                WHERE id = %s
                RETURNING id
                """,
                values,
            )
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(status_code=404, detail="Computer not found")
            cur.execute(_computer_select() + " WHERE c.id = %s", (computer_id,))
            row = cur.fetchone()
            conn.commit()
    return {"message": "computer updated", "data": _serialize_computer(row)}


@router.delete(
    "/computers/{computer_id}",
    response_model=MessageResponse,
    summary="Deactivate computer",
)
def delete_computer(computer_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE computers
                SET is_active = FALSE, updated_at = NOW()
                WHERE id = %s
                RETURNING id
                """,
                (computer_id,),
            )
            updated = cur.fetchone()
            conn.commit()

    if not updated:
        raise HTTPException(status_code=404, detail="Computer not found")
    return {"message": "computer deactivated"}


@router.patch("/computers/{computer_id}/assign", response_model=ComputerEnvelope, summary="Assign computer to employee")
def assign_computer(computer_id: str, data: ComputerAssign, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            if data.employee_id:
                cur.execute("SELECT 1 FROM employees WHERE id = %s", (data.employee_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Employee not found")
            cur.execute(
                """
                UPDATE computers
                SET employee_id = %s, updated_at = NOW()
                WHERE id = %s
                RETURNING id
                """,
                (data.employee_id, computer_id),
            )
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(status_code=404, detail="Computer not found")
            cur.execute(_computer_select() + " WHERE c.id = %s", (computer_id,))
            row = cur.fetchone()
            conn.commit()
    return {"message": "computer assigned", "data": _serialize_computer(row)}


@router.get(
    "/computer-activity",
    response_model=ComputerActivityListResponse,
    summary="List computer activity events",
)
def list_computer_activity(
    page: int = Query(..., ge=1),
    limit: int = Query(..., ge=1, le=200),
    employee_id: str | None = None,
    computer_id: str | None = None,
    app_name: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    user=Depends(require_role(["admin", "hr"])),
):
    filters = []
    params = []
    if employee_id:
        filters.append("cae.employee_id = %s")
        params.append(employee_id)
    if computer_id:
        filters.append("cae.computer_id = %s")
        params.append(computer_id)
    if app_name:
        filters.append("LOWER(cae.app_name) LIKE LOWER(%s)")
        params.append(f"%{app_name}%")

    start_dt = parse_filter_date(date_from)
    end_dt = parse_filter_date(date_to, end_of_day=True)
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="date_from cannot be greater than date_to")
    if start_dt:
        filters.append("cae.started_at >= %s")
        params.append(start_dt)
    if end_dt:
        filters.append("cae.started_at <= %s")
        params.append(end_dt)

    where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
    offset = (page - 1) * limit
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM computer_activity_events cae{where_clause}", params)
            total = cur.fetchone()[0]
            cur.execute(
                f"""
                SELECT
                    cae.id,
                    cae.computer_id,
                    cae.employee_id,
                    cae.app_name,
                    cae.window_title,
                    cae.url,
                    cae.started_at,
                    cae.ended_at,
                    cae.duration_seconds,
                    cae.created_at,
                    c.hostname,
                    e.full_name
                FROM computer_activity_events cae
                LEFT JOIN computers c ON c.id = cae.computer_id
                LEFT JOIN employees e ON e.id = cae.employee_id
                {where_clause}
                ORDER BY cae.started_at DESC
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            rows = cur.fetchall()
    return {
        "meta": {"page": page, "limit": limit, "total": total},
        "data": [_serialize_activity(row) for row in rows],
    }


@router.get(
    "/computer-analytics",
    response_model=ComputerAnalyticsResponse,
    summary="Computer activity analytics",
)
def computer_analytics(
    date_from: str,
    date_to: str,
    employee_id: str | None = None,
    user=Depends(require_role(["admin", "hr"])),
):
    start_dt = parse_filter_date(date_from)
    end_dt = parse_filter_date(date_to, end_of_day=True)
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="date_from cannot be greater than date_to")

    filters = ["cae.started_at >= %s", "cae.started_at <= %s"]
    params = [start_dt, end_dt]
    computer_filters = ["is_active = TRUE"]
    computer_params = []
    if employee_id:
        filters.append("cae.employee_id = %s")
        params.append(employee_id)
        computer_filters.append("employee_id = %s")
        computer_params.append(employee_id)

    where_clause = f"WHERE {' AND '.join(filters)}"
    computer_where = f"WHERE {' AND '.join(computer_filters)}"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT
                    COALESCE(SUM(duration_seconds), 0),
                    COUNT(DISTINCT computer_id)
                FROM computer_activity_events cae
                {where_clause}
                """,
                params,
            )
            total_duration, active_computers = cur.fetchone()
            cur.execute(
                f"""
                SELECT
                    COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '2 minutes'),
                    COUNT(*) FILTER (WHERE last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '2 minutes')
                FROM computers
                {computer_where}
                """,
                computer_params,
            )
            online_computers, offline_computers = cur.fetchone()
            cur.execute(
                f"""
                SELECT app_name, COALESCE(SUM(duration_seconds), 0), COUNT(*)
                FROM computer_activity_events cae
                {where_clause}
                GROUP BY app_name
                ORDER BY SUM(duration_seconds) DESC
                LIMIT 10
                """,
                params,
            )
            top_apps = [
                {"name": row[0], "duration_seconds": row[1], "events": row[2]}
                for row in cur.fetchall()
            ]
            cur.execute(
                f"""
                SELECT
                    cae.id,
                    cae.computer_id,
                    cae.employee_id,
                    cae.app_name,
                    cae.window_title,
                    cae.url,
                    cae.started_at,
                    cae.ended_at,
                    cae.duration_seconds,
                    cae.created_at,
                    c.hostname,
                    e.full_name
                FROM computer_activity_events cae
                LEFT JOIN computers c ON c.id = cae.computer_id
                LEFT JOIN employees e ON e.id = cae.employee_id
                {where_clause}
                ORDER BY cae.started_at DESC
                LIMIT 20
                """,
                params,
            )
            recent_rows = cur.fetchall()

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT url, COALESCE(SUM(duration_seconds), 0), COUNT(*)
                FROM computer_activity_events cae
                {where_clause}
                  AND url IS NOT NULL
                  AND url <> ''
                GROUP BY url
                """,
                params,
            )
            site_rows = cur.fetchall()

    site_map = {}
    for url, duration, count in site_rows:
        site = _site_from_url(url)
        if not site:
            continue
        current = site_map.setdefault(site, {"name": site, "duration_seconds": 0, "events": 0})
        current["duration_seconds"] += int(duration or 0)
        current["events"] += int(count or 0)

    recent_activity = [_serialize_activity(row) for row in recent_rows]
    for item in recent_activity:
        site = _site_from_url(item["url"])
        if not site:
            continue

    top_sites = sorted(
        site_map.values(),
        key=lambda value: value["duration_seconds"],
        reverse=True,
    )[:10]

    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_duration_seconds": int(total_duration or 0),
        "active_computers": active_computers,
        "online_computers": online_computers,
        "offline_computers": offline_computers,
        "top_apps": top_apps,
        "top_sites": top_sites,
        "recent_activity": recent_activity,
    }
