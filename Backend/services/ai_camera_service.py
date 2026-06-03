import os
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import quote, unquote, urlsplit, urlunsplit

from fastapi import HTTPException
from psycopg2.extras import Json

from services.device_service import parse_datetime_input


ZONE_TYPES = {
    "WORK_ROOM",
    "CORRIDOR",
    "REST_ZONE",
    "MEETING_ROOM",
    "ENTRANCE",
    "EXIT",
    "UNKNOWN",
}


CAMERA_SELECT = """
    SELECT
        c.id,
        c.name,
        c.ip,
        c.username,
        c.password_encrypted IS NOT NULL,
        c.rtsp_main_url,
        c.rtsp_sub_url,
        c.isapi_base_url,
        c.zone_id,
        z.name,
        z.type,
        c.room_id,
        r.name,
        c.has_audio,
        c.has_speaker,
        c.status,
        c.last_checked_at,
        c.last_error,
        c.created_at,
        c.updated_at
    FROM cameras c
    JOIN zones z ON z.id = c.zone_id
    LEFT JOIN rooms r ON r.id = c.room_id
"""


ROOM_SELECT = """
    SELECT
        r.id,
        r.name,
        r.department_id,
        d.name,
        r.floor,
        r.description,
        r.created_at
    FROM rooms r
    LEFT JOIN departments d ON d.id = r.department_id
"""


ZONE_SELECT = """
    SELECT
        z.id,
        z.name,
        z.type,
        z.productivity_weight,
        z.timeout_seconds,
        z.created_at,
        COUNT(c.id) AS camera_count
    FROM zones z
    LEFT JOIN cameras c ON c.zone_id = z.id
"""


def provided_fields(model) -> set[str]:
    return set(getattr(model, "model_fields_set", getattr(model, "__fields_set__", set())))


def item_value(item, name: str, default=None):
    if isinstance(item, dict):
        return item.get(name, default)
    return getattr(item, name, default)


def camera_credential_secret() -> str:
    secret = os.getenv("CAMERA_CREDENTIAL_SECRET") or os.getenv("JWT_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=500, detail="Camera credential secret is not configured")
    if len(secret.encode("utf-8")) < 32:
        raise HTTPException(status_code=500, detail="Camera credential secret must be at least 32 bytes")
    return secret


def stream_url(camera_id: str, profile: str = "main") -> str:
    return f"/cameras/{camera_id}/stream?profile={profile}"


def audio_url(camera_id: str) -> str:
    return f"/cameras/{camera_id}/audio"


def sanitize_rtsp_url(raw: str | None) -> tuple[str | None, str | None, str | None]:
    if raw is None:
        return None, None, None
    value = raw.strip()
    if not value:
        return value, None, None

    parsed = urlsplit(value)
    username = unquote(parsed.username) if parsed.username else None
    password = unquote(parsed.password) if parsed.password else None
    if not parsed.scheme or not parsed.netloc:
        return value, username, password

    host = parsed.hostname or ""
    if parsed.port:
        host = f"{host}:{parsed.port}"
    sanitized = urlunsplit((parsed.scheme, host, parsed.path, parsed.query, parsed.fragment))
    return sanitized, username, password


def inject_rtsp_credentials(raw: str, username: str, password: str | None):
    if not password:
        return raw
    parsed = urlsplit(raw)
    if not parsed.scheme or not parsed.netloc:
        return raw
    host = parsed.hostname or ""
    if parsed.port:
        host = f"{host}:{parsed.port}"
    netloc = f"{quote(username, safe='')}:{quote(password, safe='')}@{host}"
    return urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment))


def serialize_zone(row):
    return {
        "id": str(row[0]),
        "name": row[1],
        "type": row[2],
        "productivity_weight": float(row[3] or 0),
        "timeout_seconds": int(row[4] or 0),
        "created_at": str(row[5]),
        "camera_count": int(row[6] or 0),
    }


def serialize_camera(row):
    camera_id = str(row[0])
    return {
        "id": camera_id,
        "name": row[1],
        "ip": row[2],
        "username": row[3],
        "password_configured": bool(row[4]),
        "rtsp_main_url": row[5],
        "rtsp_sub_url": row[6],
        "isapi_base_url": row[7],
        "zone_id": str(row[8]),
        "zone_name": row[9],
        "zone_type": row[10],
        "room_id": str(row[11]) if row[11] else None,
        "room_name": row[12],
        "has_audio": bool(row[13]),
        "has_speaker": bool(row[14]),
        "status": row[15],
        "last_checked_at": str(row[16]) if row[16] else None,
        "last_error": row[17],
        "created_at": str(row[18]),
        "updated_at": str(row[19]),
        "stream_url": stream_url(camera_id),
        "audio_url": audio_url(camera_id),
    }


def serialize_camera_mini(row):
    camera_id = str(row[0])
    return {
        "id": camera_id,
        "name": row[1],
        "ip": row[2],
        "status": row[3],
        "zone_id": str(row[4]),
        "zone_name": row[5],
        "has_audio": bool(row[6]),
        "has_speaker": bool(row[7]),
        "is_primary": bool(row[8]),
        "view_position": row[9],
        "stream_url": stream_url(camera_id),
        "audio_url": audio_url(camera_id),
    }


def default_crossing_rule(camera_id: str):
    return {
        "id": None,
        "camera_id": camera_id,
        "name": "Main crossing line",
        "enabled": False,
        "line_x1": 0.5,
        "line_y1": 0.1,
        "line_x2": 0.5,
        "line_y2": 0.9,
        "entry_direction": "negative_to_positive",
        "created_at": None,
        "updated_at": None,
    }


def serialize_crossing_rule(row, camera_id: str | None = None):
    if not row:
        if not camera_id:
            return None
        return default_crossing_rule(camera_id)
    return {
        "id": str(row[0]),
        "camera_id": str(row[1]),
        "name": row[2],
        "enabled": bool(row[3]),
        "line_x1": float(row[4]),
        "line_y1": float(row[5]),
        "line_x2": float(row[6]),
        "line_y2": float(row[7]),
        "entry_direction": row[8],
        "created_at": str(row[9]) if row[9] else None,
        "updated_at": str(row[10]) if row[10] else None,
    }


def crossing_rule_select():
    return """
        SELECT
            id,
            camera_id,
            name,
            enabled,
            line_x1,
            line_y1,
            line_x2,
            line_y2,
            entry_direction,
            created_at,
            updated_at
        FROM camera_crossing_rules
    """


def serialize_room(row, cameras=None):
    return {
        "id": str(row[0]),
        "name": row[1],
        "department_id": str(row[2]) if row[2] else None,
        "department_name": row[3],
        "floor": row[4],
        "description": row[5],
        "created_at": str(row[6]),
        "cameras": cameras or [],
    }


def ensure_zone(cur, zone_id: str | None):
    if not zone_id:
        return
    cur.execute("SELECT 1 FROM zones WHERE id = %s", (zone_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Zone not found")


def ensure_room(cur, room_id: str | None):
    if not room_id:
        return
    cur.execute("SELECT 1 FROM rooms WHERE id = %s", (room_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Room not found")


def ensure_department(cur, department_id: str | None):
    if not department_id:
        return
    cur.execute("SELECT 1 FROM departments WHERE id = %s", (department_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Department not found")


def ensure_employee(cur, employee_id: str | None):
    if not employee_id:
        return
    cur.execute("SELECT 1 FROM employees WHERE id = %s AND is_active = TRUE", (employee_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Employee not found")


def ensure_camera(cur, camera_id: str):
    cur.execute("SELECT 1 FROM cameras WHERE id = %s", (camera_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Camera not found")


def fetch_camera(cur, camera_id: str):
    cur.execute(CAMERA_SELECT + " WHERE c.id = %s", (camera_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Camera not found")
    return serialize_camera(row)


def fetch_room(cur, room_id: str):
    cur.execute(ROOM_SELECT + " WHERE r.id = %s", (room_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Room not found")
    return serialize_room(row, list_room_cameras(cur, room_id))


def fetch_zone(cur, zone_id: str):
    cur.execute(ZONE_SELECT + " WHERE z.id = %s GROUP BY z.id", (zone_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Zone not found")
    return serialize_zone(row)


def list_room_cameras(cur, room_id: str):
    cur.execute(
        """
        SELECT
            c.id,
            c.name,
            c.ip,
            c.status,
            z.id,
            z.name,
            c.has_audio,
            c.has_speaker,
            rc.is_primary,
            rc.view_position
        FROM room_camera rc
        JOIN cameras c ON c.id = rc.camera_id
        JOIN zones z ON z.id = c.zone_id
        WHERE rc.room_id = %s
        ORDER BY rc.is_primary DESC, rc.created_at ASC
        """,
        (room_id,),
    )
    return [serialize_camera_mini(row) for row in cur.fetchall()]


def normalize_camera_values(values: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(values)
    main_url, url_user, url_password = sanitize_rtsp_url(normalized.get("rtsp_main_url"))
    sub_url, sub_user, sub_password = sanitize_rtsp_url(normalized.get("rtsp_sub_url"))

    if main_url is not None:
        normalized["rtsp_main_url"] = main_url
    if sub_url is not None:
        normalized["rtsp_sub_url"] = sub_url or None
    if not normalized.get("username") and (url_user or sub_user):
        normalized["username"] = url_user or sub_user
    if not normalized.get("password") and (url_password or sub_password):
        normalized["password"] = url_password or sub_password
    return normalized


def sync_room_cameras(cur, room_id: str, cameras: list):
    cur.execute(
        """
        SELECT camera_id
        FROM room_camera
        WHERE room_id = %s
        """,
        (room_id,),
    )
    previous_ids = {str(row[0]) for row in cur.fetchall()}

    camera_inputs = []
    seen = set()
    for item in cameras:
        camera_id = item_value(item, "camera_id")
        if camera_id in seen:
            raise HTTPException(status_code=400, detail="Duplicate camera in room")
        seen.add(camera_id)
        camera_inputs.append(item)

    if camera_inputs and not any(bool(item_value(item, "is_primary", False)) for item in camera_inputs):
        first = camera_inputs[0]
        if hasattr(first, "is_primary"):
            first.is_primary = True
        else:
            first["is_primary"] = True

    if sum(1 for item in camera_inputs if bool(item_value(item, "is_primary", False))) > 1:
        raise HTTPException(status_code=400, detail="Only one primary camera is allowed per room")

    for item in camera_inputs:
        camera_id = item_value(item, "camera_id")
        cur.execute("SELECT 1 FROM cameras WHERE id = %s", (camera_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Camera not found")

    cur.execute("DELETE FROM room_camera WHERE room_id = %s", (room_id,))

    next_ids = set()
    for item in camera_inputs:
        camera_id = item_value(item, "camera_id")
        is_primary = bool(item_value(item, "is_primary", False))
        view_position = item_value(item, "view_position")
        cur.execute(
            """
            INSERT INTO room_camera (room_id, camera_id, is_primary, view_position)
            VALUES (%s, %s, %s, %s)
            """,
            (room_id, camera_id, is_primary, view_position),
        )
        next_ids.add(camera_id)

    removed = previous_ids - next_ids
    if removed:
        cur.execute(
            """
            UPDATE cameras
            SET room_id = NULL, updated_at = NOW()
            WHERE room_id = %s AND id = ANY(%s::uuid[])
            """,
            (room_id, list(removed)),
        )
    if next_ids:
        cur.execute(
            """
            UPDATE cameras
            SET room_id = %s, updated_at = NOW()
            WHERE id = ANY(%s::uuid[])
            """,
            (room_id, list(next_ids)),
        )


def primary_camera_for_room(cur, room_id: str | None):
    if not room_id:
        return None
    cur.execute(
        """
        SELECT c.id
        FROM room_camera rc
        JOIN cameras c ON c.id = rc.camera_id
        WHERE rc.room_id = %s
        ORDER BY rc.is_primary DESC, rc.created_at ASC
        LIMIT 1
        """,
        (room_id,),
    )
    row = cur.fetchone()
    return str(row[0]) if row else None


def assignment_for_employee(cur, employee_id: str):
    cur.execute(
        """
        SELECT id, employee_id, assigned_room_id, assigned_camera_id, created_at, updated_at
        FROM employee_camera_assignments
        WHERE employee_id = %s
        """,
        (employee_id,),
    )
    return cur.fetchone()


def serialize_assignment(cur, row):
    try:
        room = fetch_room(cur, str(row[2]))
    except HTTPException:
        room = None
    return {
        "id": str(row[0]),
        "employee_id": str(row[1]),
        "assigned_room_id": str(row[2]),
        "assigned_camera_id": str(row[3]) if row[3] else None,
        "created_at": str(row[4]),
        "updated_at": str(row[5]),
        "room": room,
    }


def upsert_employee_room_assignment(cur, employee_id: str, room_id: str):
    ensure_employee(cur, employee_id)
    ensure_room(cur, room_id)
    assigned_camera_id = primary_camera_for_room(cur, room_id)
    cur.execute(
        """
        INSERT INTO employee_camera_assignments (
            employee_id,
            assigned_room_id,
            assigned_camera_id,
            updated_at
        )
        VALUES (%s, %s, %s, NOW())
        ON CONFLICT (employee_id)
        DO UPDATE SET
            assigned_room_id = EXCLUDED.assigned_room_id,
            assigned_camera_id = EXCLUDED.assigned_camera_id,
            updated_at = NOW()
        RETURNING id, employee_id, assigned_room_id, assigned_camera_id, created_at, updated_at
        """,
        (employee_id, room_id, assigned_camera_id),
    )
    return serialize_assignment(cur, cur.fetchone())


def _employee_ref(row):
    return {
        "id": str(row[0]),
        "full_name": row[1],
        "employee_code": row[2],
        "department": {"id": str(row[3]) if row[3] else None, "name": row[4]},
        "position": {"id": str(row[5]) if row[5] else None, "name": row[6]},
    }


def _fetch_employee(cur, employee_id: str):
    cur.execute(
        """
        SELECT e.id, e.full_name, e.employee_code, d.id, d.name, p.id, p.name
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN positions p ON p.id = e.position_id
        WHERE e.id = %s AND e.is_active = TRUE
        """,
        (employee_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Employee not found")
    return _employee_ref(row)


def _state_row(cur, employee_id: str):
    cur.execute(
        """
        SELECT
            employee_id,
            active_camera_id,
            active_zone_id,
            active_room_id,
            last_seen_at,
            last_detection_type,
            confidence,
            is_visible,
            inferred_zone_id,
            updated_at
        FROM employee_location_states
        WHERE employee_id = %s
        """,
        (employee_id,),
    )
    return cur.fetchone()


def _apply_inference(cur, state):
    if not state:
        return False, False, None

    last_seen_at = state[4]
    if not last_seen_at:
        return False, False, None

    visible_ttl = int(os.getenv("AI_CAMERA_VISIBLE_TTL_SECONDS", "30"))
    now = datetime.now()
    age_seconds = max(0, int((now - last_seen_at).total_seconds()))
    is_visible = bool(state[7]) and age_seconds <= visible_ttl
    inferred_zone_id = str(state[8]) if state[8] else None
    inferred = False

    active_zone_id = state[2]
    if not is_visible and active_zone_id:
        cur.execute(
            "SELECT type, timeout_seconds FROM zones WHERE id = %s",
            (active_zone_id,),
        )
        zone = cur.fetchone()
        if zone and int(zone[1] or 0) > 0 and age_seconds <= int(zone[1] or 0):
            if zone[0] in {"REST_ZONE", "MEETING_ROOM", "WORK_ROOM"}:
                inferred = True
                inferred_zone_id = str(active_zone_id)

    return is_visible, inferred, inferred_zone_id


def build_live_location(cur, employee_id: str):
    employee = _fetch_employee(cur, employee_id)
    state = _state_row(cur, employee_id)
    is_visible, inferred, inferred_zone_id = _apply_inference(cur, state)

    assigned_room = None
    assigned_camera_id = None
    assigned_cameras = []
    assignment = assignment_for_employee(cur, employee_id)
    if assignment:
        try:
            assigned_room = fetch_room(cur, str(assignment[2]))
        except HTTPException:
            assigned_room = None
        assigned_camera_id = str(assignment[3]) if assignment[3] else primary_camera_for_room(cur, str(assignment[2]))
        assigned_cameras = assigned_room["cameras"] if assigned_room else []

    try:
        active_camera = fetch_camera(cur, str(state[1])) if state and state[1] else None
    except HTTPException:
        active_camera = None
    try:
        active_zone = fetch_zone(cur, str(state[2])) if state and state[2] else None
    except HTTPException:
        active_zone = None
    try:
        active_room = fetch_room(cur, str(state[3])) if state and state[3] else None
    except HTTPException:
        active_room = None

    return {
        "employee_id": employee_id,
        "employee": employee,
        "active_camera_id": str(state[1]) if state and state[1] else None,
        "active_zone_id": str(state[2]) if state and state[2] else None,
        "assigned_camera_id": assigned_camera_id,
        "is_visible": is_visible,
        "inferred": inferred,
        "last_seen_at": str(state[4]) if state and state[4] else None,
        "detection_type": state[5] if state else None,
        "confidence": float(state[6]) if state and state[6] is not None else None,
        "active_camera": active_camera,
        "active_zone": active_zone,
        "active_room": active_room,
        "assigned_room": assigned_room,
        "assigned_cameras": assigned_cameras,
        "inferred_zone_id": inferred_zone_id,
        "updated_at": str(state[9]) if state and state[9] else None,
    }


def location_event_payload(live_location: dict[str, Any]):
    return {
        "employee_id": live_location["employee_id"],
        "active_camera_id": live_location["active_camera_id"],
        "active_zone_id": live_location["active_zone_id"],
        "assigned_camera_id": live_location["assigned_camera_id"],
        "is_visible": live_location["is_visible"],
        "inferred": live_location["inferred"],
        "last_seen_at": live_location["last_seen_at"],
        "detection_type": live_location["detection_type"],
        "confidence": live_location["confidence"],
    }


def _active_detection(cur, employee_id: str, seen_at: datetime):
    lower_bound = seen_at - timedelta(seconds=int(os.getenv("AI_CAMERA_MULTI_MATCH_WINDOW_SECONDS", "5")))
    cur.execute(
        """
        SELECT
            cde.camera_id,
            c.zone_id,
            c.room_id,
            cde.seen_at,
            cde.detection_type,
            cde.confidence
        FROM camera_detection_events cde
        JOIN cameras c ON c.id = cde.camera_id
        LEFT JOIN employee_camera_assignments eca ON eca.employee_id = cde.employee_id
        LEFT JOIN room_camera rc ON rc.camera_id = cde.camera_id
            AND rc.room_id = eca.assigned_room_id
        WHERE cde.employee_id = %s
          AND cde.seen_at >= %s
          AND cde.disappeared_at IS NULL
        ORDER BY cde.seen_at DESC, cde.confidence DESC, COALESCE(rc.is_primary, FALSE) DESC
        LIMIT 1
        """,
        (employee_id, lower_bound),
    )
    return cur.fetchone()


def record_detection_event(cur, data):
    ensure_employee(cur, data.employee_id)
    cur.execute("SELECT zone_id, room_id FROM cameras WHERE id = %s", (data.camera_id,))
    camera = cur.fetchone()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")

    seen_at = parse_datetime_input(data.seen_at) if data.seen_at else datetime.now()
    disappeared_at = parse_datetime_input(data.disappeared_at) if data.disappeared_at else None
    duration_seconds = data.duration_seconds
    if duration_seconds is None and disappeared_at:
        duration_seconds = max(0, int((disappeared_at - seen_at).total_seconds()))

    cur.execute(
        """
        INSERT INTO camera_detection_events (
            camera_id, employee_id, track_id, detection_type,
            confidence, bbox, zone_id,
            seen_at, disappeared_at, duration_seconds, snapshot_path
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (camera_id, track_id) WHERE disappeared_at IS NULL
        DO UPDATE SET
            seen_at          = EXCLUDED.seen_at,
            confidence       = EXCLUDED.confidence,
            bbox             = EXCLUDED.bbox,
            disappeared_at   = EXCLUDED.disappeared_at,
            duration_seconds = EXCLUDED.duration_seconds,
            snapshot_path    = COALESCE(EXCLUDED.snapshot_path,
                                        camera_detection_events.snapshot_path)
        RETURNING id
        """,
        (
            data.camera_id,
            data.employee_id,
            data.track_id,
            data.detection_type.value if hasattr(data.detection_type, "value") else data.detection_type,
            data.confidence,
            Json(data.bbox) if data.bbox is not None else None,
            camera[0],
            seen_at,
            disappeared_at,
            duration_seconds,
            data.snapshot_path,
        ),
    )
    event_id = cur.fetchone()[0]

    live_location = None
    if data.employee_id:
        if disappeared_at:
            cur.execute(
                """
                UPDATE employee_location_states
                SET
                    is_visible = FALSE,
                    inferred_zone_id = NULL,
                    updated_at = NOW()
                WHERE employee_id = %s
                  AND (last_seen_at IS NULL OR last_seen_at <= %s)
                """,
                (data.employee_id, seen_at),
            )
        else:
            active = _active_detection(cur, data.employee_id, seen_at)
            if active:
                cur.execute(
                    """
                    INSERT INTO employee_location_states (
                        employee_id,
                        active_camera_id,
                        active_zone_id,
                        active_room_id,
                        last_seen_at,
                        last_detection_type,
                        confidence,
                        is_visible,
                        inferred_zone_id,
                        updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, NULL, NOW())
                    ON CONFLICT (employee_id)
                    DO UPDATE SET
                        active_camera_id = EXCLUDED.active_camera_id,
                        active_zone_id = EXCLUDED.active_zone_id,
                        active_room_id = EXCLUDED.active_room_id,
                        last_seen_at = EXCLUDED.last_seen_at,
                        last_detection_type = EXCLUDED.last_detection_type,
                        confidence = EXCLUDED.confidence,
                        is_visible = TRUE,
                        inferred_zone_id = NULL,
                        updated_at = NOW()
                    """,
                    (
                        data.employee_id,
                        active[0],
                        active[1],
                        active[2],
                        active[3],
                        active[4],
                        active[5],
                    ),
                )
        live_location = build_live_location(cur, data.employee_id)

    return str(event_id), live_location


def get_camera_crossing_rule(cur, camera_id: str):
    ensure_camera(cur, camera_id)
    cur.execute(crossing_rule_select() + " WHERE camera_id = %s", (camera_id,))
    return serialize_crossing_rule(cur.fetchone(), camera_id)


def _validate_crossing_line(values: dict[str, Any], current: dict[str, Any] | None = None):
    merged = dict(current or default_crossing_rule(values.get("camera_id", "")))
    merged.update({key: value for key, value in values.items() if value is not None})
    if (
        float(merged["line_x1"]) == float(merged["line_x2"])
        and float(merged["line_y1"]) == float(merged["line_y2"])
    ):
        raise HTTPException(status_code=400, detail="Crossing line endpoints cannot be the same")
    return merged


def upsert_camera_crossing_rule(cur, camera_id: str, data):
    ensure_camera(cur, camera_id)
    current = get_camera_crossing_rule(cur, camera_id)
    values = provided_fields(data)
    raw = data.model_dump(exclude_unset=True) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)
    if not values:
        return current

    merged = _validate_crossing_line(raw, current)
    direction_value = data.direction.value if hasattr(data.direction, "value") else data.direction
    cur.execute(
        """
        INSERT INTO camera_crossing_rules (
            camera_id,
            name,
            enabled,
            line_x1,
            line_y1,
            line_x2,
            line_y2,
            entry_direction,
            updated_at
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (camera_id)
        DO UPDATE SET
            name = EXCLUDED.name,
            enabled = EXCLUDED.enabled,
            line_x1 = EXCLUDED.line_x1,
            line_y1 = EXCLUDED.line_y1,
            line_x2 = EXCLUDED.line_x2,
            line_y2 = EXCLUDED.line_y2,
            entry_direction = EXCLUDED.entry_direction,
            updated_at = NOW()
        RETURNING id,
            camera_id,
            name,
            enabled,
            line_x1,
            line_y1,
            line_x2,
            line_y2,
            entry_direction,
            created_at,
            updated_at
        """,
        (
            camera_id,
            merged["name"],
            merged["enabled"],
            merged["line_x1"],
            merged["line_y1"],
            merged["line_x2"],
            merged["line_y2"],
            merged["entry_direction"].value
            if hasattr(merged["entry_direction"], "value")
            else merged["entry_direction"],
        ),
    )
    return serialize_crossing_rule(cur.fetchone())


def record_crossing_event(cur, data):
    ensure_camera(cur, data.camera_id)
    ensure_employee(cur, data.employee_id)
    cur.execute(
        """
        SELECT c.room_id, ccr.id
        FROM cameras c
        LEFT JOIN camera_crossing_rules ccr ON ccr.camera_id = c.id
        WHERE c.id = %s
        """,
        (data.camera_id,),
    )
    rule = cur.fetchone()
    room_id = rule[0] if rule else None
    rule_id = rule[1] if rule else None
    crossed_at = parse_datetime_input(data.crossed_at) if data.crossed_at else datetime.now()
    cur.execute(
        """
        INSERT INTO camera_crossing_events (
            camera_id,
            rule_id,
            employee_id,
            track_id,
            direction,
            crossing_direction,
            confidence,
            bbox,
            crossed_at,
            snapshot_path
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            data.camera_id,
            rule_id,
            data.employee_id,
            data.track_id,
            direction_value,
            data.crossing_direction.value
            if hasattr(data.crossing_direction, "value")
            else data.crossing_direction,
            data.confidence,
            Json(data.bbox) if data.bbox is not None else None,
            crossed_at,
            data.snapshot_path,
        ),
    )
    event_id = str(cur.fetchone()[0])
    if direction_value == "entry":
        record_room_presence_entry(
            cur,
            camera_id=data.camera_id,
            room_id=str(room_id) if room_id else None,
            employee_id=data.employee_id,
            track_id=data.track_id,
            entered_at=crossed_at,
            confidence=data.confidence,
        )
    else:
        mark_room_presence_pending_exit(
            cur,
            camera_id=data.camera_id,
            room_id=str(room_id) if room_id else None,
            track_id=data.track_id,
            pending_exit_at=crossed_at,
        )
    return event_id


def _open_room_presence(cur, camera_id: str, track_id: str, room_id: str | None):
    cur.execute(
        """
        SELECT id, status
        FROM camera_room_presence
        WHERE camera_id = %s
          AND track_id = %s
          AND (room_id IS NOT DISTINCT FROM %s)
          AND exited_at IS NULL
        ORDER BY entered_at DESC
        LIMIT 1
        """,
        (camera_id, track_id, room_id),
    )
    return cur.fetchone()


def record_room_presence_entry(
    cur,
    camera_id: str,
    room_id: str | None,
    employee_id: str | None,
    track_id: str,
    entered_at: datetime,
    confidence: float | None,
):
    open_row = _open_room_presence(cur, camera_id, track_id, room_id)
    if open_row:
        cur.execute(
            """
            UPDATE camera_room_presence
            SET
                employee_id = COALESCE(employee_id, %s),
                pending_exit_at = NULL,
                status = 'inside',
                confidence = COALESCE(%s, confidence),
                updated_at = NOW()
            WHERE id = %s
            """,
            (employee_id, confidence, open_row[0]),
        )
        return str(open_row[0])

    cur.execute(
        """
        INSERT INTO camera_room_presence (
            employee_id,
            track_id,
            camera_id,
            room_id,
            entered_at,
            confidence,
            status
        )
        VALUES (%s, %s, %s, %s, %s, %s, 'inside')
        RETURNING id
        """,
        (employee_id, track_id, camera_id, room_id, entered_at, confidence),
    )
    return str(cur.fetchone()[0])


def mark_room_presence_pending_exit(
    cur,
    camera_id: str,
    room_id: str | None,
    track_id: str,
    pending_exit_at: datetime,
):
    open_row = _open_room_presence(cur, camera_id, track_id, room_id)
    if not open_row:
        return None
    cur.execute(
        """
        UPDATE camera_room_presence
        SET
            pending_exit_at = %s,
            status = 'pending_exit',
            updated_at = NOW()
        WHERE id = %s
          AND exited_at IS NULL
        RETURNING id
        """,
        (pending_exit_at, open_row[0]),
    )
    row = cur.fetchone()
    return str(row[0]) if row else None


def confirm_room_presence_exit(cur, camera_id: str, track_id: str, exited_at: datetime | None = None):
    cur.execute(
        """
        SELECT id, entered_at, pending_exit_at
        FROM camera_room_presence
        WHERE camera_id = %s
          AND track_id = %s
          AND exited_at IS NULL
          AND pending_exit_at IS NOT NULL
        ORDER BY pending_exit_at DESC
        LIMIT 1
        """,
        (camera_id, track_id),
    )
    row = cur.fetchone()
    if not row:
        return None

    exit_time = exited_at or row[2] or datetime.now()
    duration_seconds = max(0, int((exit_time - row[1]).total_seconds()))
    cur.execute(
        """
        UPDATE camera_room_presence
        SET
            exited_at = %s,
            duration_seconds = %s,
            status = 'exited',
            updated_at = NOW()
        WHERE id = %s
        RETURNING id
        """,
        (exit_time, duration_seconds, row[0]),
    )
    updated = cur.fetchone()
    return str(updated[0]) if updated else None


def cancel_room_presence_pending_exit(cur, camera_id: str, track_id: str):
    cur.execute(
        """
        UPDATE camera_room_presence
        SET
            pending_exit_at = NULL,
            status = 'inside',
            updated_at = NOW()
        WHERE camera_id = %s
          AND track_id = %s
          AND exited_at IS NULL
          AND pending_exit_at IS NOT NULL
        RETURNING id
        """,
        (camera_id, track_id),
    )
    return [str(row[0]) for row in cur.fetchall()]


def list_room_presence(
    cur,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    employee_id: str | None = None,
    track_id: str | None = None,
    room_id: str | None = None,
    camera_id: str | None = None,
    page: int = 1,
    limit: int = 50,
):
    conditions = []
    params: list[Any] = []
    if date_from:
        conditions.append("crp.entered_at >= %s")
        params.append(date_from)
    if date_to:
        conditions.append("crp.entered_at <= %s")
        params.append(date_to)
    if employee_id:
        conditions.append("crp.employee_id = %s")
        params.append(employee_id)
    if track_id:
        conditions.append("crp.track_id = %s")
        params.append(track_id)
    if room_id:
        conditions.append("crp.room_id = %s")
        params.append(room_id)
    if camera_id:
        conditions.append("crp.camera_id = %s")
        params.append(camera_id)
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    cur.execute(f"SELECT COUNT(*) FROM camera_room_presence crp {where}", params)
    total = cur.fetchone()[0]
    offset = (page - 1) * limit
    cur.execute(
        f"""
        SELECT
            crp.id,
            crp.employee_id,
            e.full_name,
            crp.track_id,
            crp.camera_id,
            c.name,
            crp.room_id,
            r.name,
            crp.entered_at,
            crp.pending_exit_at,
            crp.exited_at,
            crp.duration_seconds,
            crp.confidence,
            crp.status
        FROM camera_room_presence crp
        JOIN cameras c ON c.id = crp.camera_id
        LEFT JOIN rooms r ON r.id = crp.room_id
        LEFT JOIN employees e ON e.id = crp.employee_id
        {where}
        ORDER BY crp.entered_at DESC, crp.created_at DESC
        LIMIT %s OFFSET %s
        """,
        params + [limit, offset],
    )
    return total, [
        {
            "id": str(row[0]),
            "employee_id": str(row[1]) if row[1] else None,
            "employee_name": row[2],
            "track_id": row[3],
            "camera_id": str(row[4]),
            "camera_name": row[5],
            "room_id": str(row[6]) if row[6] else None,
            "room_name": row[7],
            "entered_at": str(row[8]),
            "pending_exit_at": str(row[9]) if row[9] else None,
            "exited_at": str(row[10]) if row[10] else None,
            "duration_seconds": row[11],
            "confidence": float(row[12]) if row[12] is not None else None,
            "status": row[13],
        }
        for row in cur.fetchall()
    ]


def list_crossing_events(
    cur,
    camera_id: str | None = None,
    room_id: str | None = None,
    employee_id: str | None = None,
    direction: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    limit: int = 50,
):
    conditions = []
    params: list[Any] = []
    if camera_id:
        conditions.append("cce.camera_id = %s")
        params.append(camera_id)
    if room_id:
        conditions.append("c.room_id = %s")
        params.append(room_id)
    if employee_id:
        conditions.append("cce.employee_id = %s")
        params.append(employee_id)
    if direction:
        conditions.append("cce.direction = %s")
        params.append(direction)
    if date_from:
        conditions.append("cce.crossed_at >= %s")
        params.append(date_from)
    if date_to:
        conditions.append("cce.crossed_at <= %s")
        params.append(date_to)
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    cur.execute(
        f"""
        SELECT COUNT(*)
        FROM camera_crossing_events cce
        JOIN cameras c ON c.id = cce.camera_id
        {where}
        """,
        params,
    )
    total = cur.fetchone()[0]
    offset = (page - 1) * limit
    cur.execute(
        f"""
        SELECT
            cce.id,
            cce.camera_id,
            c.name,
            r.id,
            r.name,
            cce.employee_id,
            e.full_name,
            cce.track_id,
            cce.direction,
            cce.crossing_direction,
            cce.confidence,
            cce.crossed_at,
            cce.bbox,
            cce.snapshot_path
        FROM camera_crossing_events cce
        JOIN cameras c ON c.id = cce.camera_id
        LEFT JOIN rooms r ON r.id = c.room_id
        LEFT JOIN employees e ON e.id = cce.employee_id
        {where}
        ORDER BY cce.crossed_at DESC, cce.created_at DESC
        LIMIT %s OFFSET %s
        """,
        params + [limit, offset],
    )
    return total, [
        {
            "id": str(row[0]),
            "camera_id": str(row[1]),
            "camera_name": row[2],
            "room_id": str(row[3]) if row[3] else None,
            "room_name": row[4],
            "employee_id": str(row[5]) if row[5] else None,
            "employee_name": row[6],
            "track_id": row[7],
            "direction": row[8],
            "crossing_direction": row[9],
            "confidence": float(row[10]) if row[10] is not None else None,
            "crossed_at": str(row[11]),
            "bbox": row[12],
            "snapshot_path": row[13],
        }
        for row in cur.fetchall()
    ]


def link_camera_track_to_employee(cur, camera_id: str, track_id: str, employee_id: str):
    ensure_camera(cur, camera_id)
    ensure_employee(cur, employee_id)
    cur.execute(
        """
        UPDATE camera_detection_events
        SET employee_id = %s
        WHERE camera_id = %s
          AND track_id = %s
          AND employee_id IS NULL
        """,
        (employee_id, camera_id, track_id),
    )
    detections_updated = cur.rowcount
    cur.execute(
        """
        UPDATE camera_crossing_events
        SET employee_id = %s
        WHERE camera_id = %s
          AND track_id = %s
          AND employee_id IS NULL
        """,
        (employee_id, camera_id, track_id),
    )
    crossings_updated = cur.rowcount
    cur.execute(
        """
        UPDATE camera_room_presence
        SET employee_id = %s, updated_at = NOW()
        WHERE camera_id = %s
          AND track_id = %s
          AND employee_id IS NULL
        """,
        (employee_id, camera_id, track_id),
    )
    presence_updated = cur.rowcount
    return {
        "camera_id": camera_id,
        "track_id": track_id,
        "employee_id": employee_id,
        "detections_updated": detections_updated,
        "crossings_updated": crossings_updated,
        "presence_updated": presence_updated,
    }


def link_unknown_detection_to_employee(cur, detection_id: str, employee_id: str):
    cur.execute(
        """
        SELECT camera_id, track_id
        FROM camera_detection_events
        WHERE id = %s
        """,
        (detection_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Detection not found")
    return link_camera_track_to_employee(cur, str(row[0]), row[1], employee_id)


def link_crossing_event_to_employee(cur, crossing_event_id: str, employee_id: str):
    cur.execute(
        """
        SELECT camera_id, track_id
        FROM camera_crossing_events
        WHERE id = %s
        """,
        (crossing_event_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Crossing event not found")
    return link_camera_track_to_employee(cur, str(row[0]), row[1], employee_id)


def timeline_for_employee(cur, employee_id: str, limit: int):
    ensure_employee(cur, employee_id)
    cur.execute(
        """
        SELECT
            cde.id,
            c.id,
            c.name,
            z.id,
            z.name,
            z.type,
            r.id,
            r.name,
            cde.detection_type,
            cde.confidence,
            cde.track_id,
            cde.seen_at,
            cde.disappeared_at,
            cde.duration_seconds,
            cde.snapshot_path
        FROM camera_detection_events cde
        JOIN cameras c ON c.id = cde.camera_id
        JOIN zones z ON z.id = cde.zone_id
        LEFT JOIN rooms r ON r.id = c.room_id
        WHERE cde.employee_id = %s
        ORDER BY cde.seen_at DESC
        LIMIT %s
        """,
        (employee_id, limit),
    )
    return [
        {
            "id": str(row[0]),
            "camera_id": str(row[1]),
            "camera_name": row[2],
            "zone_id": str(row[3]),
            "zone_name": row[4],
            "zone_type": row[5],
            "room_id": str(row[6]) if row[6] else None,
            "room_name": row[7],
            "detection_type": row[8],
            "confidence": float(row[9]),
            "track_id": row[10],
            "seen_at": str(row[11]),
            "disappeared_at": str(row[12]) if row[12] else None,
            "duration_seconds": row[13],
            "snapshot_path": row[14],
        }
        for row in cur.fetchall()
    ]


def daily_timeline_for_employee(cur, employee_id: str, day_start: datetime, day_end: datetime):
    """
    Kun bo'yi xom detection eventlarni toza zona-segmentlarga birlashtiradi.
    Ya'ni "09:00 - 10:30 Ish xonasi, 10:30 - 10:45 Koridor" ko'rinishida.

    Bir xil zonadagi va orasidagi tanaffus AI_CAMERA_TIMELINE_GAP_SECONDS dan
    kichik bo'lgan ketma-ket eventlar bitta segmentga qo'shiladi.
    """
    ensure_employee(cur, employee_id)
    gap_seconds = int(os.getenv("AI_CAMERA_TIMELINE_GAP_SECONDS", "120"))

    cur.execute(
        """
        SELECT
            cde.seen_at,
            cde.disappeared_at,
            cde.duration_seconds,
            z.id,
            z.name,
            z.type,
            c.id,
            c.name,
            r.id,
            r.name
        FROM camera_detection_events cde
        JOIN cameras c ON c.id = cde.camera_id
        JOIN zones z ON z.id = cde.zone_id
        LEFT JOIN rooms r ON r.id = c.room_id
        WHERE cde.employee_id = %s
          AND cde.seen_at >= %s
          AND cde.seen_at <= %s
        ORDER BY cde.seen_at ASC
        """,
        (employee_id, day_start, day_end),
    )
    rows = cur.fetchall()

    segments: list[dict] = []
    current: dict | None = None

    for row in rows:
        seen_at, disappeared_at, duration, zone_id, zone_name, zone_type, cam_id, cam_name, room_id, room_name = row
        if disappeared_at:
            event_end = disappeared_at
        elif duration:
            event_end = seen_at + timedelta(seconds=int(duration))
        else:
            event_end = seen_at

        same_zone = current is not None and str(current["zone_id"]) == str(zone_id)
        within_gap = current is not None and (seen_at - current["end"]).total_seconds() <= gap_seconds

        if current is not None and same_zone and within_gap:
            if event_end > current["end"]:
                current["end"] = event_end
            current["detections"] += 1
            current["camera_id"] = str(cam_id)
            current["camera_name"] = cam_name
        else:
            if current is not None:
                segments.append(current)
            current = {
                "zone_id": str(zone_id),
                "zone_name": zone_name,
                "zone_type": zone_type,
                "camera_id": str(cam_id),
                "camera_name": cam_name,
                "room_id": str(room_id) if room_id else None,
                "room_name": room_name,
                "start": seen_at,
                "end": event_end,
                "detections": 1,
            }

    if current is not None:
        segments.append(current)

    serialized_segments = []
    zone_totals: dict[str, dict] = {}
    total_tracked = 0

    for seg in segments:
        duration_seconds = max(0, int((seg["end"] - seg["start"]).total_seconds()))
        total_tracked += duration_seconds
        serialized_segments.append(
            {
                "zone_id": seg["zone_id"],
                "zone_name": seg["zone_name"],
                "zone_type": seg["zone_type"],
                "camera_id": seg["camera_id"],
                "camera_name": seg["camera_name"],
                "room_id": seg["room_id"],
                "room_name": seg["room_name"],
                "start_at": str(seg["start"]),
                "end_at": str(seg["end"]),
                "start_clock": seg["start"].strftime("%H:%M:%S"),
                "end_clock": seg["end"].strftime("%H:%M:%S"),
                "duration_seconds": duration_seconds,
                "detections": seg["detections"],
            }
        )
        bucket = zone_totals.setdefault(
            seg["zone_id"],
            {
                "zone_id": seg["zone_id"],
                "zone_name": seg["zone_name"],
                "zone_type": seg["zone_type"],
                "total_seconds": 0,
            },
        )
        bucket["total_seconds"] += duration_seconds

    return {
        "employee_id": employee_id,
        "date": day_start.strftime("%Y-%m-%d"),
        "first_seen_at": str(segments[0]["start"]) if segments else None,
        "last_seen_at": str(segments[-1]["end"]) if segments else None,
        "total_tracked_seconds": total_tracked,
        "segments": serialized_segments,
        "zone_totals": sorted(
            zone_totals.values(), key=lambda item: item["total_seconds"], reverse=True
        ),
    }


def productivity_for_employee(cur, employee_id: str, date_from: datetime, date_to: datetime):
    ensure_employee(cur, employee_id)
    assignment = assignment_for_employee(cur, employee_id)
    assigned_room_id = str(assignment[2]) if assignment else None
    total_seconds = max(0, int((date_to - date_from).total_seconds()))

    cur.execute(
        """
        SELECT
            cde.camera_id,
            c.room_id,
            z.type,
            COALESCE(
                cde.duration_seconds,
                EXTRACT(EPOCH FROM (COALESCE(cde.disappeared_at, cde.seen_at) - cde.seen_at))::int,
                0
            ) AS seconds
        FROM camera_detection_events cde
        JOIN cameras c ON c.id = cde.camera_id
        JOIN zones z ON z.id = cde.zone_id
        WHERE cde.employee_id = %s
          AND cde.seen_at >= %s
          AND cde.seen_at <= %s
        """,
        (employee_id, date_from, date_to),
    )
    assigned_room_seconds = 0
    work_zone_seconds = 0
    rest_zone_seconds = 0
    corridor_seconds = 0
    unknown_seconds = 0

    for _camera_id, room_id, zone_type, seconds in cur.fetchall():
        seconds = max(0, int(seconds or 0))
        is_assigned_room = assigned_room_id and room_id and str(room_id) == assigned_room_id
        if is_assigned_room:
            assigned_room_seconds += seconds
        elif zone_type == "WORK_ROOM":
            work_zone_seconds += seconds
        elif zone_type == "REST_ZONE":
            rest_zone_seconds += seconds
        elif zone_type == "CORRIDOR":
            corridor_seconds += seconds
        elif zone_type in {"UNKNOWN", "ENTRANCE", "EXIT"}:
            unknown_seconds += seconds

    inferred_zone_seconds = 0
    visible_or_known = (
        assigned_room_seconds
        + work_zone_seconds
        + rest_zone_seconds
        + corridor_seconds
        + unknown_seconds
        + inferred_zone_seconds
    )
    not_visible_seconds = max(0, total_seconds - visible_or_known)
    score = (
        assigned_room_seconds * 1.0
        + work_zone_seconds * 0.7
        - rest_zone_seconds * 0.3
        - unknown_seconds * 0.2
        - not_visible_seconds * 0.4
    )

    return {
        "assigned_room_visible_seconds": assigned_room_seconds,
        "work_zone_visible_seconds": work_zone_seconds,
        "rest_zone_seconds": rest_zone_seconds,
        "corridor_seconds": corridor_seconds,
        "unknown_seconds": unknown_seconds,
        "not_visible_seconds": not_visible_seconds,
        "inferred_zone_seconds": inferred_zone_seconds,
        "productivity_score": round(float(score), 2),
    }


def list_unknown_detections(
    cur,
    camera_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    active_only: bool = False,
    page: int = 1,
    limit: int = 50,
):
    conditions = ["cde.employee_id IS NULL"]
    params: list = []

    if camera_id:
        conditions.append("cde.camera_id = %s")
        params.append(camera_id)
    if date_from:
        conditions.append("cde.seen_at >= %s")
        params.append(date_from)
    if date_to:
        conditions.append("cde.seen_at <= %s")
        params.append(date_to)
    if active_only:
        window_seconds = int(os.getenv("AI_CAMERA_LIVE_UNKNOWN_WINDOW_SECONDS", "60"))
        conditions.append("cde.disappeared_at IS NULL")
        conditions.append("cde.seen_at >= NOW() - (%s * INTERVAL '1 second')")
        params.append(window_seconds)

    where = " AND ".join(conditions)

    cur.execute(
        f"SELECT COUNT(*) FROM camera_detection_events cde WHERE {where}",
        params,
    )
    total = cur.fetchone()[0]

    offset = (page - 1) * limit
    cur.execute(
        f"""
        SELECT
            cde.id, cde.camera_id, c.name, c.ip,
            z.id, z.name,
            c.room_id, r.name,
            cde.track_id, cde.detection_type, cde.confidence,
            cde.seen_at, cde.disappeared_at, cde.duration_seconds,
            cde.snapshot_path, cde.bbox
        FROM camera_detection_events cde
        JOIN cameras c ON c.id = cde.camera_id
        JOIN zones z ON z.id = cde.zone_id
        LEFT JOIN rooms r ON r.id = c.room_id
        WHERE {where}
        ORDER BY cde.seen_at DESC
        LIMIT %s OFFSET %s
        """,
        params + [limit, offset],
    )
    rows = cur.fetchall()
    data = [
        {
            "id": str(row[0]),
            "camera_id": str(row[1]),
            "camera_name": row[2],
            "camera_ip": row[3],
            "zone_id": str(row[4]),
            "zone_name": row[5],
            "room_id": str(row[6]) if row[6] else None,
            "room_name": row[7],
            "track_id": row[8],
            "detection_type": row[9],
            "confidence": float(row[10]),
            "seen_at": str(row[11]),
            "disappeared_at": str(row[12]) if row[12] else None,
            "duration_seconds": row[13],
            "snapshot_path": row[14],
            "bbox": row[15],
        }
        for row in rows
    ]
    if active_only:
        data = dedupe_live_unknown_detections(data)
        total = len(data)
    return total, data


def _bbox_center(bbox):
    if not bbox:
        return None
    try:
        return (
            float(bbox.get("x", 0)) + float(bbox.get("w", 0)) / 2,
            float(bbox.get("y", 0)) + float(bbox.get("h", 0)) / 2,
        )
    except (TypeError, ValueError, AttributeError):
        return None


def _same_live_person(candidate: dict, kept: dict, max_distance: float, max_age_seconds: float) -> bool:
    if candidate.get("camera_id") != kept.get("camera_id"):
        return False
    first_center = _bbox_center(candidate.get("bbox"))
    second_center = _bbox_center(kept.get("bbox"))
    if not first_center or not second_center:
        return False

    try:
        first_seen = parse_datetime_input(candidate["seen_at"])
        second_seen = parse_datetime_input(kept["seen_at"])
    except Exception:
        return False
    if abs((second_seen - first_seen).total_seconds()) > max_age_seconds:
        return False

    dx = first_center[0] - second_center[0]
    dy = first_center[1] - second_center[1]
    return (dx * dx + dy * dy) ** 0.5 <= max_distance


def dedupe_live_unknown_detections(items: list[dict]) -> list[dict]:
    """Collapse short-lived duplicate body tracks that represent one visible person."""
    max_distance = float(os.getenv("AI_CAMERA_LIVE_UNKNOWN_DEDUPE_DISTANCE", "140"))
    max_age_seconds = float(os.getenv("AI_CAMERA_LIVE_UNKNOWN_DEDUPE_SECONDS", "20"))
    kept: list[dict] = []
    for item in items:
        if any(_same_live_person(item, existing, max_distance, max_age_seconds) for existing in kept):
            continue
        kept.append(item)
    return kept


def live_unknown_per_camera(cur):
    """Latest active unknown detections grouped by camera track."""
    window_seconds = int(os.getenv("AI_CAMERA_LIVE_UNKNOWN_WINDOW_SECONDS", "60"))
    cur.execute(
        """
        WITH latest_tracks AS (
            SELECT DISTINCT ON (cde.camera_id, cde.track_id)
                cde.id,
                cde.camera_id,
                cde.track_id,
                cde.detection_type,
                cde.confidence,
                cde.seen_at,
                cde.disappeared_at,
                cde.snapshot_path,
                cde.bbox
            FROM camera_detection_events cde
            WHERE cde.employee_id IS NULL
              AND cde.seen_at >= NOW() - (%s * INTERVAL '1 second')
            ORDER BY cde.camera_id, cde.track_id, cde.seen_at DESC, cde.created_at DESC
        )
        SELECT
            id,
            camera_id,
            track_id,
            detection_type,
            confidence,
            seen_at,
            snapshot_path,
            bbox
        FROM latest_tracks
        WHERE disappeared_at IS NULL
        ORDER BY seen_at DESC, confidence DESC
        """,
        (window_seconds,),
    )
    data = [
        {
            "id": str(row[0]),
            "camera_id": str(row[1]),
            "track_id": row[2],
            "detection_type": row[3],
            "confidence": float(row[4]),
            "seen_at": str(row[5]),
            "snapshot_path": row[6],
            "bbox": row[7],
        }
        for row in cur.fetchall()
    ]
    return dedupe_live_unknown_detections(data)


def live_matched_per_camera(cur):
    """Latest active matched (identified) detections grouped by camera track."""
    window_seconds = int(os.getenv("AI_CAMERA_LIVE_UNKNOWN_WINDOW_SECONDS", "60"))
    cur.execute(
        """
        WITH latest_tracks AS (
            SELECT DISTINCT ON (cde.camera_id, cde.track_id)
                cde.id,
                cde.camera_id,
                cde.track_id,
                cde.employee_id,
                e.full_name,
                cde.detection_type,
                cde.confidence,
                cde.seen_at,
                cde.disappeared_at,
                cde.snapshot_path,
                cde.bbox
            FROM camera_detection_events cde
            JOIN employees e ON e.id = cde.employee_id
            WHERE cde.employee_id IS NOT NULL
              AND cde.seen_at >= NOW() - (%s * INTERVAL '1 second')
            ORDER BY cde.camera_id, cde.track_id, cde.seen_at DESC, cde.created_at DESC
        )
        SELECT
            id,
            camera_id,
            track_id,
            employee_id,
            full_name,
            detection_type,
            confidence,
            seen_at,
            snapshot_path,
            bbox
        FROM latest_tracks
        WHERE disappeared_at IS NULL
        ORDER BY seen_at DESC, confidence DESC
        """,
        (window_seconds,),
    )
    return [
        {
            "id": str(row[0]),
            "camera_id": str(row[1]),
            "track_id": row[2],
            "employee_id": str(row[3]),
            "employee_name": row[4],
            "detection_type": row[5],
            "confidence": float(row[6]),
            "seen_at": str(row[7]),
            "snapshot_path": row[8],
            "bbox": row[9],
        }
        for row in cur.fetchall()
    ]


def media_gateway_url(kind: str, camera_id: str, profile: str | None = None):
    base = os.getenv("AI_CAMERA_MEDIA_GATEWAY_URL", "").strip().rstrip("/")
    if not base:
        raise HTTPException(status_code=503, detail="AI camera media gateway is not configured")
    suffix = f"/cameras/{camera_id}/{kind}"
    if profile:
        suffix += f"?profile={profile}"
    return base + suffix


# ============ Face embeddings (enrollment / matching) ============

def store_face_embedding(cur, data):
    """Xodim yuzining embedding'ini saqlaydi (enroll skript/worker yuboradi)."""
    ensure_employee(cur, data.employee_id)
    if not data.embedding:
        raise HTTPException(status_code=400, detail="Embedding vector is empty")

    if getattr(data, "replace", False):
        cur.execute(
            "DELETE FROM employee_face_embeddings WHERE employee_id = %s",
            (data.employee_id,),
        )

    cur.execute(
        """
        INSERT INTO employee_face_embeddings (
            employee_id, embedding_vector, snapshot_path, confidence, updated_at
        )
        VALUES (%s, %s, %s, %s, NOW())
        RETURNING id
        """,
        (
            data.employee_id,
            list(data.embedding),
            data.snapshot_path,
            float(data.confidence if data.confidence is not None else 1.0),
        ),
    )
    return str(cur.fetchone()[0])


def list_face_embeddings(cur):
    """Worker matching uchun barcha aktiv xodim embeddinglarini qaytaradi."""
    cur.execute(
        """
        SELECT f.employee_id, f.embedding_vector
        FROM employee_face_embeddings f
        JOIN employees e ON e.id = f.employee_id
        WHERE e.is_active = TRUE
        ORDER BY f.employee_id
        """
    )
    return [
        {"employee_id": str(row[0]), "embedding": [float(x) for x in (row[1] or [])]}
        for row in cur.fetchall()
    ]


def list_pending_enrollment(cur):
    """Rasmi bor, lekin hali embedding'i yo'q aktiv xodimlar (enroll navbati)."""
    cur.execute(
        """
        SELECT e.id, e.full_name, e.photo_url
        FROM employees e
        WHERE e.is_active = TRUE
          AND e.photo_url IS NOT NULL
          AND e.photo_url <> ''
          AND NOT EXISTS (
            SELECT 1 FROM employee_face_embeddings f WHERE f.employee_id = e.id
          )
        ORDER BY e.created_at ASC
        """
    )
    return [
        {"employee_id": str(row[0]), "full_name": row[1], "photo_url": row[2]}
        for row in cur.fetchall()
    ]
