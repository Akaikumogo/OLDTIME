import os
import re
from urllib.parse import quote, urljoin

import requests
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.responses import Response, StreamingResponse

from db import get_connection
from schemas.ai_camera import (
    CameraCreate,
    CameraEnvelope,
    CameraListResponse,
    CameraProductivityBreakdown,
    CameraTalkRequest,
    CameraTalkResponse,
    CameraTestResponse,
    CameraUpdate,
    CameraCrossingEventCreate,
    CameraCrossingEventListResponse,
    CameraCrossingRuleEnvelope,
    CameraCrossingRuleUpdate,
    CameraRoomPresenceCancelExitRequest,
    CameraRoomPresenceExitRequest,
    CameraRoomPresenceListResponse,
    CameraTrackLinkRequest,
    EmployeeDailyTimelineResponse,
    EmployeeCameraAssignmentResponse,
    EmployeeCameraViewsResponse,
    EmployeeLiveLocationResponse,
    EmployeeLocationStateListResponse,
    EmployeeRoomAssignmentRequest,
    LocationTimelineResponse,
    RoomCreate,
    RoomEnvelope,
    RoomListResponse,
    RoomUpdate,
    ZoneCreate,
    ZoneEnvelope,
    ZoneListResponse,
    ZoneUpdate,
    CameraDetectionCreate,
    LiveUnknownDetectionsResponse,
    LiveMatchedDetectionsResponse,
    UnknownDetectionListResponse,
    FaceEmbeddingStoreRequest,
    FaceEmbeddingListResponse,
    PendingEnrollmentListResponse,
)
from schemas.common import MessageResponse
from services.ai_camera_service import (
    CAMERA_SELECT,
    ROOM_SELECT,
    ZONE_SELECT,
    build_live_location,
    camera_credential_secret,
    daily_timeline_for_employee,
    fetch_camera,
    fetch_room,
    get_camera_crossing_rule,
    cancel_room_presence_pending_exit,
    confirm_room_presence_exit,
    inject_rtsp_credentials,
    link_crossing_event_to_employee,
    link_unknown_detection_to_employee,
    list_crossing_events,
    list_room_presence,
    list_room_cameras,
    list_unknown_detections,
    live_unknown_per_camera,
    live_matched_per_camera,
    location_event_payload,
    list_face_embeddings,
    list_pending_enrollment,
    media_gateway_url,
    normalize_camera_values,
    store_face_embedding,
    productivity_for_employee,
    record_crossing_event,
    record_detection_event,
    serialize_camera,
    serialize_room,
    serialize_zone,
    sync_room_cameras,
    timeline_for_employee,
    upsert_camera_crossing_rule,
    upsert_employee_room_assignment,
)
from services.event_service import parse_filter_date
from utils.auth import require_role
from utils.security import _decode_token, optional_verify_token

router = APIRouter(tags=["AI Camera Tracking"])


class EmployeeLocationConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, payload: dict):
        stale = []
        for connection in self.active_connections:
            try:
                await connection.send_json(payload)
            except Exception:
                stale.append(connection)
        for connection in stale:
            self.disconnect(connection)


location_connections = EmployeeLocationConnectionManager()


def _require_camera_agent_token(authorization: str | None = Header(None)):
    # Auth o'chirilgan: recognition worker backend bilan bir serverda (localhost)
    # ishlaydi va backend o'zi ishga tushiradi, shuning uchun token tekshirilmaydi.
    return None


def _provided_dict(model):
    return model.model_dump(exclude_unset=True) if hasattr(model, "model_dump") else model.dict(exclude_unset=True)


def _authorize_media_request(token: str | None, user):
    if user is None and token:
        user = _decode_token(token)
    role = ((user or {}).get("role") or "").lower()
    if role not in {"superadmin", "admin", "hr"}:
        raise HTTPException(status_code=403, detail="Forbidden")
    return user


def _response_message(entity: str, action: str):
    return f"{entity} {action}"


@router.get("/zones", response_model=ZoneListResponse, summary="List AI camera zones")
def list_zones(user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(ZONE_SELECT + " GROUP BY z.id ORDER BY z.created_at DESC")
            rows = cur.fetchall()
    return {"data": [serialize_zone(row) for row in rows]}


@router.post("/zones", response_model=ZoneEnvelope, status_code=status.HTTP_201_CREATED, summary="Create zone")
def create_zone(data: ZoneCreate, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM zones WHERE name = %s", (data.name,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Zone already exists")
            cur.execute(
                """
                INSERT INTO zones (name, type, productivity_weight, timeout_seconds)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (data.name, data.type.value, data.productivity_weight, data.timeout_seconds),
            )
            zone_id = cur.fetchone()[0]
            cur.execute(ZONE_SELECT + " WHERE z.id = %s GROUP BY z.id", (zone_id,))
            row = cur.fetchone()
            conn.commit()
    return {"message": _response_message("zone", "created"), "data": serialize_zone(row)}


@router.patch("/zones/{zone_id}", response_model=ZoneEnvelope, summary="Update zone")
def update_zone(zone_id: str, data: ZoneUpdate, user=Depends(require_role(["admin", "hr"]))):
    values = _provided_dict(data)
    if not values:
        raise HTTPException(status_code=400, detail="Nothing to update")
    fields = []
    params = []
    for field, value in values.items():
        fields.append(f"{field} = %s")
        params.append(value.value if hasattr(value, "value") else value)
    params.append(zone_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            if "name" in values:
                cur.execute("SELECT 1 FROM zones WHERE name = %s AND id <> %s", (values["name"], zone_id))
                if cur.fetchone():
                    raise HTTPException(status_code=409, detail="Zone already exists")
            cur.execute(
                f"UPDATE zones SET {', '.join(fields)} WHERE id = %s RETURNING id",
                params,
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Zone not found")
            cur.execute(ZONE_SELECT + " WHERE z.id = %s GROUP BY z.id", (zone_id,))
            row = cur.fetchone()
            conn.commit()
    return {"message": _response_message("zone", "updated"), "data": serialize_zone(row)}


@router.delete("/zones/{zone_id}", response_model=MessageResponse, summary="Delete zone")
def delete_zone(zone_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM cameras WHERE zone_id = %s LIMIT 1", (zone_id,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Zone has linked cameras")
            cur.execute("DELETE FROM zones WHERE id = %s RETURNING id", (zone_id,))
            deleted = cur.fetchone()
            conn.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Zone not found")
    return {"message": _response_message("zone", "deleted")}


@router.get("/rooms", response_model=RoomListResponse, summary="List rooms")
def list_rooms(user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(ROOM_SELECT + " ORDER BY r.created_at DESC")
            rows = cur.fetchall()
            data = [serialize_room(row, list_room_cameras(cur, str(row[0]))) for row in rows]
    return {"data": data}


@router.post("/rooms", response_model=RoomEnvelope, status_code=status.HTTP_201_CREATED, summary="Create room")
def create_room(data: RoomCreate, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            if data.department_id:
                cur.execute("SELECT 1 FROM departments WHERE id = %s", (data.department_id,))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Department not found")
            cur.execute("SELECT 1 FROM rooms WHERE name = %s", (data.name,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Room already exists")
            cur.execute(
                """
                INSERT INTO rooms (name, department_id, floor, description)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (data.name, data.department_id, data.floor, data.description),
            )
            room_id = cur.fetchone()[0]
            sync_room_cameras(cur, str(room_id), data.cameras)
            room = fetch_room(cur, str(room_id))
            conn.commit()
    return {"message": _response_message("room", "created"), "data": room}


@router.patch("/rooms/{room_id}", response_model=RoomEnvelope, summary="Update room")
def update_room(room_id: str, data: RoomUpdate, user=Depends(require_role(["admin", "hr"]))):
    values = _provided_dict(data)
    if not values:
        raise HTTPException(status_code=400, detail="Nothing to update")
    cameras = values.pop("cameras", None)
    fields = []
    params = []
    for field, value in values.items():
        fields.append(f"{field} = %s")
        params.append(value)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM rooms WHERE id = %s", (room_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Room not found")
            if values.get("department_id"):
                cur.execute("SELECT 1 FROM departments WHERE id = %s", (values["department_id"],))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Department not found")
            if "name" in values:
                cur.execute("SELECT 1 FROM rooms WHERE name = %s AND id <> %s", (values["name"], room_id))
                if cur.fetchone():
                    raise HTTPException(status_code=409, detail="Room already exists")
            if fields:
                params.append(room_id)
                cur.execute(
                    f"UPDATE rooms SET {', '.join(fields)} WHERE id = %s",
                    params,
                )
            if cameras is not None:
                sync_room_cameras(cur, room_id, cameras)
            room = fetch_room(cur, room_id)
            conn.commit()
    return {"message": _response_message("room", "updated"), "data": room}


@router.delete("/rooms/{room_id}", response_model=MessageResponse, summary="Delete room")
def delete_room(room_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM employee_camera_assignments WHERE assigned_room_id = %s LIMIT 1", (room_id,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Room is assigned to employees")
            cur.execute("DELETE FROM rooms WHERE id = %s RETURNING id", (room_id,))
            deleted = cur.fetchone()
            conn.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"message": _response_message("room", "deleted")}


@router.get("/cameras", response_model=CameraListResponse, summary="List cameras")
def list_cameras(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    zone_id: str | None = None,
    room_id: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    user=Depends(require_role(["admin", "hr"])),
):
    filters = []
    params = []
    if zone_id:
        filters.append("c.zone_id = %s")
        params.append(zone_id)
    if room_id:
        filters.append("c.room_id = %s")
        params.append(room_id)
    if status_filter:
        filters.append("c.status = %s")
        params.append(status_filter)
    where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
    offset = (page - 1) * limit
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM cameras c{where_clause}", params)
            total = cur.fetchone()[0]
            cur.execute(
                CAMERA_SELECT + f"{where_clause} ORDER BY c.created_at DESC LIMIT %s OFFSET %s",
                params + [limit, offset],
            )
            rows = cur.fetchall()
    return {
        "meta": {"page": page, "limit": limit, "total": total},
        "data": [serialize_camera(row) for row in rows],
    }


@router.post("/cameras", response_model=CameraEnvelope, status_code=status.HTTP_201_CREATED, summary="Create camera")
def create_camera(data: CameraCreate, user=Depends(require_role(["admin", "hr"]))):
    values = normalize_camera_values(_provided_dict(data))
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM zones WHERE id = %s", (values["zone_id"],))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Zone not found")
            if values.get("room_id"):
                cur.execute("SELECT 1 FROM rooms WHERE id = %s", (values["room_id"],))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Room not found")
            secret = camera_credential_secret()
            cur.execute(
                """
                INSERT INTO cameras (
                    name,
                    ip,
                    username,
                    password_encrypted,
                    rtsp_main_url,
                    rtsp_sub_url,
                    isapi_base_url,
                    zone_id,
                    room_id,
                    has_audio,
                    has_speaker,
                    status,
                    updated_at
                )
                VALUES (%s, %s, %s, pgp_sym_encrypt(%s, %s), %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
                """,
                (
                    values["name"],
                    values["ip"],
                    values["username"],
                    values["password"],
                    secret,
                    values["rtsp_main_url"],
                    values.get("rtsp_sub_url"),
                    values.get("isapi_base_url"),
                    values["zone_id"],
                    values.get("room_id"),
                    values.get("has_audio", False),
                    values.get("has_speaker", False),
                    values.get("status", "unknown").value
                    if hasattr(values.get("status", "unknown"), "value")
                    else values.get("status", "unknown"),
                ),
            )
            camera_id = cur.fetchone()[0]
            if values.get("room_id"):
                cur.execute(
                    """
                    INSERT INTO room_camera (room_id, camera_id, is_primary)
                    VALUES (
                        %s,
                        %s,
                        NOT EXISTS (SELECT 1 FROM room_camera WHERE room_id = %s)
                    )
                    ON CONFLICT (room_id, camera_id) DO NOTHING
                    """,
                    (values["room_id"], camera_id, values["room_id"]),
                )
            camera = fetch_camera(cur, str(camera_id))
            conn.commit()
    return {"message": _response_message("camera", "created"), "data": camera}


@router.patch("/cameras/{camera_id}", response_model=CameraEnvelope, summary="Update camera")
def update_camera(camera_id: str, data: CameraUpdate, user=Depends(require_role(["admin", "hr"]))):
    values = normalize_camera_values(_provided_dict(data))
    if not values:
        raise HTTPException(status_code=400, detail="Nothing to update")
    fields = []
    params = []
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM cameras WHERE id = %s", (camera_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Camera not found")
            if values.get("zone_id"):
                cur.execute("SELECT 1 FROM zones WHERE id = %s", (values["zone_id"],))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Zone not found")
            if "room_id" in values and values.get("room_id"):
                cur.execute("SELECT 1 FROM rooms WHERE id = %s", (values["room_id"],))
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Room not found")

            for field, column in {
                "name": "name",
                "ip": "ip",
                "username": "username",
                "rtsp_main_url": "rtsp_main_url",
                "rtsp_sub_url": "rtsp_sub_url",
                "isapi_base_url": "isapi_base_url",
                "zone_id": "zone_id",
                "room_id": "room_id",
                "has_audio": "has_audio",
                "has_speaker": "has_speaker",
                "status": "status",
            }.items():
                if field in values:
                    value = values[field]
                    fields.append(f"{column} = %s")
                    params.append(value.value if hasattr(value, "value") else value)
            if "password" in values:
                fields.append("password_encrypted = pgp_sym_encrypt(%s, %s)")
                params.extend([values["password"], camera_credential_secret()])
            if not fields:
                raise HTTPException(status_code=400, detail="Nothing to update")
            params.append(camera_id)
            cur.execute(
                f"UPDATE cameras SET {', '.join(fields)}, updated_at = NOW() WHERE id = %s",
                params,
            )
            if "room_id" in values:
                cur.execute("DELETE FROM room_camera WHERE camera_id = %s", (camera_id,))
                if values.get("room_id"):
                    cur.execute(
                        """
                        INSERT INTO room_camera (room_id, camera_id, is_primary)
                        VALUES (
                            %s,
                            %s,
                            NOT EXISTS (SELECT 1 FROM room_camera WHERE room_id = %s)
                        )
                        ON CONFLICT (room_id, camera_id) DO NOTHING
                        """,
                        (values["room_id"], camera_id, values["room_id"]),
                    )
            camera = fetch_camera(cur, camera_id)
            conn.commit()
    return {"message": _response_message("camera", "updated"), "data": camera}


@router.delete("/cameras/{camera_id}", response_model=MessageResponse, summary="Delete camera")
def delete_camera(camera_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM cameras WHERE id = %s RETURNING id", (camera_id,))
            deleted = cur.fetchone()
            conn.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Camera not found")
    return {"message": _response_message("camera", "deleted")}


@router.post("/cameras/{camera_id}/test", response_model=CameraTestResponse, summary="Test camera connection")
def test_camera(camera_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            camera = fetch_camera(cur, camera_id)
            status_value = "unknown"
            message = "Camera saved. Configure AI_CAMERA_MEDIA_GATEWAY_URL for live RTSP probe."
            if os.getenv("AI_CAMERA_MEDIA_GATEWAY_URL"):
                status_value = "testing"
                message = "Media gateway configured; live probe delegated to gateway."
            cur.execute(
                """
                UPDATE cameras
                SET status = %s, last_checked_at = NOW(), last_error = NULL, updated_at = NOW()
                WHERE id = %s
                """,
                (status_value, camera_id),
            )
            conn.commit()
    return {
        "camera_id": camera_id,
        "status": status_value,
        "message": message,
        "snapshot_url": None,
        "has_audio": camera["has_audio"],
        "has_speaker": camera["has_speaker"],
    }


@router.post("/cameras/{camera_id}/snapshot", response_model=CameraTestResponse, summary="Create camera snapshot")
def snapshot_camera(camera_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            camera = fetch_camera(cur, camera_id)
    snapshot_url = os.getenv("AI_CAMERA_MEDIA_GATEWAY_URL", "").rstrip("/")
    if snapshot_url:
        snapshot_url = f"{snapshot_url}/cameras/{camera_id}/snapshot"
    else:
        snapshot_url = None
    return {
        "camera_id": camera_id,
        "status": camera["status"],
        "message": "Snapshot delegated to media gateway" if snapshot_url else "Media gateway is not configured",
        "snapshot_url": snapshot_url,
        "has_audio": camera["has_audio"],
        "has_speaker": camera["has_speaker"],
    }


@router.post("/cameras/{camera_id}/talk", response_model=CameraTalkResponse, summary="Camera speaker talkback")
def talk_camera(camera_id: str, data: CameraTalkRequest, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            camera = fetch_camera(cur, camera_id)
    if not camera["has_speaker"]:
        raise HTTPException(status_code=400, detail="Camera speaker is not supported")
    gateway = os.getenv("AI_CAMERA_TALKBACK_GATEWAY_URL") or os.getenv("AI_CAMERA_MEDIA_GATEWAY_URL")
    if not gateway:
        raise HTTPException(status_code=503, detail="Camera talkback gateway is not configured")
    return {
        "camera_id": camera_id,
        "status": data.action,
        "message": f"Talkback {data.action} delegated to gateway",
        "talkback_url": f"{gateway.rstrip('/')}/cameras/{camera_id}/talk",
    }


def _get_gateway_url(request: Request) -> str:
    """
    Get the media gateway URL based on the incoming request's Host header.
    This allows video streaming to work from any network machine, not just localhost.

    Example: If client accesses from 192.168.0.165:8000, returns http://192.168.0.165:1984
    """
    import sys
    gateway_config = os.getenv("AI_CAMERA_MEDIA_GATEWAY_URL", "").strip().rstrip("/")
    if not gateway_config:
        raise HTTPException(status_code=503, detail="AI_CAMERA_MEDIA_GATEWAY_URL sozlanmagan (.env ga qo'shing)")

    # Extract the port from configured gateway URL
    gateway_port = "1984"  # default port
    if "://" in gateway_config:
        host_part = gateway_config.split("://", 1)[1]  # Get everything after http://
        if ":" in host_part:
            gateway_port = host_part.split(":", 1)[1]  # Get the port part

    # Get the client's host (without port) from the request
    client_host = request.headers.get("host", "localhost").split(":")[0]
    gateway_url = f"http://{client_host}:{gateway_port}"

    # Debug logging
    print(f"[DEBUG] gateway_config={gateway_config}, gateway_port={gateway_port}, client_host={client_host}, gateway_url={gateway_url}", file=sys.stderr)

    return gateway_url


def _go2rtc_video_source(rtsp_url: str) -> str:
    hwaccel = os.getenv("GO2RTC_VIDEO_HWACCEL", "").strip().lower()
    if not hwaccel or hwaccel in {"0", "false", "no", "off", "none"}:
        return rtsp_url
    if rtsp_url.startswith("ffmpeg:"):
        return rtsp_url

    hardware_param = "#hardware" if hwaccel == "auto" else f"#hardware={hwaccel}"
    return f"ffmpeg:{rtsp_url}#video=h264{hardware_param}"


def _go2rtc_ensure_stream(gateway: str, stream_name: str, rtsp_url: str) -> None:
    """go2rtc da stream yo'q bo'lsa qo'shadi, bor bo'lsa yangilaydi."""
    import sys
    try:
        response = requests.put(
            f"{gateway}/api/streams",
            params={"name": stream_name, "src": rtsp_url},
            timeout=3,
        )
        print(f"[DEBUG] Stream registration: {stream_name} -> {response.status_code}", file=sys.stderr)
    except Exception as exc:
        print(f"[DEBUG] Stream registration failed: {gateway}/api/streams - {exc}", file=sys.stderr)
        pass  # go2rtc ishlamayotgan bo'lsa video element o'zi xato ko'rsatadi


def _relay_gateway_response(url: str) -> StreamingResponse:
    import sys
    try:
        print(f"[DEBUG] Fetching from gateway: {url}", file=sys.stderr)
        upstream = requests.get(url, stream=True, timeout=(5, 30))
        print(f"[DEBUG] Gateway response: {upstream.status_code}", file=sys.stderr)
        upstream.raise_for_status()
    except requests.RequestException as exc:
        print(f"[DEBUG] Gateway request failed: {url} - {exc}", file=sys.stderr)
        raise HTTPException(status_code=502, detail=f"Media gateway javob bermadi: {exc}") from exc

    headers = {}
    content_type = upstream.headers.get("content-type")
    content_length = upstream.headers.get("content-length")
    if content_length:
        headers["content-length"] = content_length
    return StreamingResponse(
        upstream.iter_content(chunk_size=64 * 1024),
        status_code=upstream.status_code,
        media_type=content_type,
        headers=headers,
    )


def _proxy_stream_url(upstream_url: str, *, camera_id: str, token: str | None) -> str:
    token_part = f"&token={quote(token, safe='')}" if token else ""
    return f"/cameras/{camera_id}/stream-proxy?url={quote(upstream_url, safe='')}{token_part}"


def _rewrite_hls_playlist(body: str, *, gateway: str, camera_id: str, token: str | None) -> str:
    rewritten = []

    def to_proxy_url(value: str) -> str:
        upstream_url = value if value.startswith("http") else urljoin(f"{gateway}/", value.lstrip("/"))
        return _proxy_stream_url(upstream_url, camera_id=camera_id, token=token)

    def replace_uri(match: re.Match) -> str:
        return f'URI="{to_proxy_url(match.group(1))}"'

    for line in body.splitlines():
        value = line.strip()
        if not value:
            rewritten.append(line)
            continue
        if value.startswith("#"):
            rewritten.append(re.sub(r'URI="([^"]+)"', replace_uri, line))
            continue
        rewritten.append(to_proxy_url(value))
    return "\n".join(rewritten) + "\n"


def _relay_hls_playlist(url: str, *, gateway: str, camera_id: str, token: str | None) -> Response:
    try:
        upstream = requests.get(url, timeout=(5, 15))
        upstream.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Media gateway playlist bermadi: {exc}") from exc
    playlist = _rewrite_hls_playlist(
        upstream.text,
        gateway=gateway,
        camera_id=camera_id,
        token=token,
    )
    return Response(
        content=playlist,
        media_type=upstream.headers.get("content-type") or "application/vnd.apple.mpegurl",
    )


@router.get("/cameras/media-gateway/status", summary="Check camera media gateway")
def camera_media_gateway_status(user=Depends(require_role(["admin", "hr"]))):
    gateway = os.getenv("AI_CAMERA_MEDIA_GATEWAY_URL", "").strip().rstrip("/")
    if not gateway:
        return {
            "status": "not_configured",
            "gateway_url": None,
            "message": "AI_CAMERA_MEDIA_GATEWAY_URL sozlanmagan",
        }
    try:
        response = requests.get(f"{gateway}/api/streams", timeout=3)
        response.raise_for_status()
    except requests.RequestException as exc:
        return {
            "status": "offline",
            "gateway_url": gateway,
            "message": str(exc),
        }
    return {
        "status": "online",
        "gateway_url": gateway,
        "streams": response.json(),
    }


@router.get("/cameras/{camera_id}/stream", summary="Proxy camera realtime stream")
def camera_stream(
    request: Request,
    camera_id: str,
    profile: str = Query("main"),
    format: str = Query("mp4", pattern="^(mp4|hls)$"),
    token: str | None = None,
    user=Depends(optional_verify_token),
):
    _authorize_media_request(token, user)

    gateway = _get_gateway_url(request)

    secret = camera_credential_secret()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    rtsp_main_url,
                    rtsp_sub_url,
                    username,
                    CASE
                        WHEN password_encrypted IS NULL THEN NULL
                        ELSE pgp_sym_decrypt(password_encrypted, %s)
                    END
                FROM cameras
                WHERE id = %s
                """,
                (secret, camera_id),
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Camera not found")

    rtsp_main, rtsp_sub, username, password = row
    rtsp_url = (rtsp_sub if profile == "sub" and rtsp_sub else rtsp_main) or ""
    if not rtsp_url:
        raise HTTPException(status_code=503, detail="Camera RTSP URL sozlanmagan")

    rtsp_with_creds = inject_rtsp_credentials(rtsp_url, username or "", password)
    stream_name = f"cam-{camera_id}"
    _go2rtc_ensure_stream(gateway, stream_name, _go2rtc_video_source(rtsp_with_creds))

    if format == "mp4":
        return _relay_gateway_response(f"{gateway}/api/stream.mp4?src={stream_name}")

    return _relay_hls_playlist(
        f"{gateway}/api/stream.m3u8?src={stream_name}",
        gateway=gateway,
        camera_id=camera_id,
        token=token,
    )


@router.get("/cameras/{camera_id}/stream-proxy", summary="Relay camera stream segment through backend")
def camera_stream_proxy(
    request: Request,
    camera_id: str,
    url: str = Query(...),
    token: str | None = None,
    user=Depends(optional_verify_token),
):
    _authorize_media_request(token, user)
    gateway = _get_gateway_url(request)
    if not url.startswith(f"{gateway}/"):
        raise HTTPException(status_code=400, detail="Media gateway URL noto'g'ri")
    return _relay_gateway_response(url)


@router.get("/cameras/{camera_id}/audio", summary="Proxy camera audio stream")
def camera_audio(
    request: Request,
    camera_id: str,
    token: str | None = None,
    user=Depends(optional_verify_token),
):
    _authorize_media_request(token, user)
    gateway = _get_gateway_url(request)

    secret = camera_credential_secret()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    rtsp_main_url,
                    username,
                    CASE
                        WHEN password_encrypted IS NULL THEN NULL
                        ELSE pgp_sym_decrypt(password_encrypted, %s)
                    END,
                    has_audio
                FROM cameras
                WHERE id = %s
                """,
                (secret, camera_id),
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Camera not found")
    rtsp_main, username, password, has_audio = row
    if not has_audio:
        raise HTTPException(status_code=400, detail="Camera audio is not supported")
    if not rtsp_main:
        raise HTTPException(status_code=503, detail="Camera RTSP URL sozlanmagan")

    stream_name = f"cam-{camera_id}-audio-aac"
    rtsp_with_creds = inject_rtsp_credentials(rtsp_main, username or "", password)
    audio_source = f"ffmpeg:{rtsp_with_creds}#audio=aac"
    _go2rtc_ensure_stream(gateway, stream_name, audio_source)
    return _relay_gateway_response(f"{gateway}/api/stream.mp4?src={stream_name}&mp4=all")


@router.post("/cameras/{camera_id}/talkback/send-audio", summary="Send audio to camera speaker")
async def send_audio_to_camera(
    request: Request,
    camera_id: str,
    channel_id: str = Query("1"),
    token: str | None = None,
    user=Depends(optional_verify_token),
):
    _authorize_media_request(token, user)
    try:
        from services.isapi_talkback import send_audio_data
        body = await request.body()
        if not body:
            raise HTTPException(status_code=400, detail="No audio data provided")
        send_audio_data(camera_id, body, channel_id)
        return {"message": "Audio sent", "bytes": len(body)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.put(
    "/employees/{employee_id}/room-assignment",
    response_model=EmployeeCameraAssignmentResponse,
    summary="Assign employee to room for camera productivity",
)
def assign_employee_room(employee_id: str, data: EmployeeRoomAssignmentRequest, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            assignment = upsert_employee_room_assignment(cur, employee_id, data.assigned_room_id)
            conn.commit()
    return assignment


@router.get(
    "/employees/{employee_id}/live-location",
    response_model=EmployeeLiveLocationResponse,
    summary="Get employee live camera location",
)
def get_employee_live_location(employee_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            return build_live_location(cur, employee_id)


@router.get(
    "/employees/{employee_id}/camera-views",
    response_model=EmployeeCameraViewsResponse,
    summary="Get active and assigned room camera views",
)
def get_employee_camera_views(employee_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            live = build_live_location(cur, employee_id)
            assigned_primary = None
            assigned_room_cameras = live["assigned_cameras"]
            assigned_id = live["assigned_camera_id"]
            if assigned_id:
                assigned_primary = fetch_camera(cur, assigned_id)
    return {
        "employee_id": employee_id,
        "active_camera": live["active_camera"],
        "assigned_room_camera": assigned_primary,
        "assigned_room_cameras": assigned_room_cameras,
    }


@router.get(
    "/employees/{employee_id}/location-timeline",
    response_model=LocationTimelineResponse,
    summary="Get employee camera movement timeline",
)
def get_employee_location_timeline(
    employee_id: str,
    limit: int = Query(100, ge=1, le=500),
    user=Depends(require_role(["admin", "hr"])),
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            rows = timeline_for_employee(cur, employee_id, limit)
    return {"data": rows}


@router.get(
    "/employees/{employee_id}/daily-timeline",
    response_model=EmployeeDailyTimelineResponse,
    summary="Get employee daily zone timeline (merged segments)",
)
def get_employee_daily_timeline(
    employee_id: str,
    date: str,
    user=Depends(require_role(["admin", "hr"])),
):
    """Kun bo'yi xodim qaysi zonada qancha vaqt bo'lganini segment ko'rinishida qaytaradi."""
    day_start = parse_filter_date(date)
    day_end = parse_filter_date(date, end_of_day=True)
    if not day_start or not day_end:
        raise HTTPException(status_code=400, detail="date is required (YYYY-MM-DD)")
    with get_connection() as conn:
        with conn.cursor() as cur:
            return daily_timeline_for_employee(cur, employee_id, day_start, day_end)


@router.get(
    "/employees/{employee_id}/camera-productivity",
    response_model=CameraProductivityBreakdown,
    summary="Get camera-based productivity metrics",
)
def get_employee_camera_productivity(
    employee_id: str,
    date_from: str,
    date_to: str,
    user=Depends(require_role(["admin", "hr"])),
):
    start_dt = parse_filter_date(date_from)
    end_dt = parse_filter_date(date_to, end_of_day=True)
    if not start_dt or not end_dt:
        raise HTTPException(status_code=400, detail="date_from and date_to are required")
    if start_dt > end_dt:
        raise HTTPException(status_code=400, detail="date_from cannot be greater than date_to")
    with get_connection() as conn:
        with conn.cursor() as cur:
            return productivity_for_employee(cur, employee_id, start_dt, end_dt)


@router.get(
    "/employee-location-states",
    response_model=EmployeeLocationStateListResponse,
    summary="List realtime employee camera states",
)
def list_employee_location_states(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(require_role(["admin", "hr"])),
):
    offset = (page - 1) * limit
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id
                FROM employees
                WHERE is_active = TRUE
                ORDER BY full_name ASC
                LIMIT %s OFFSET %s
                """,
                (limit, offset),
            )
            employee_ids = [str(row[0]) for row in cur.fetchall()]
            data = [build_live_location(cur, employee_id) for employee_id in employee_ids]
    return {"data": data}


@router.post(
    "/internal/camera-detections",
    response_model=MessageResponse,
    summary="Store AI worker camera detection event",
)
async def create_camera_detection(
    data: CameraDetectionCreate,
    _token=Depends(_require_camera_agent_token),
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            event_id, live_location = record_detection_event(cur, data)
            conn.commit()
    if live_location:
        await location_connections.broadcast(location_event_payload(live_location))
    return {"message": f"camera detection stored: {event_id}"}


@router.get(
    "/cameras/{camera_id}/crossing-rule",
    response_model=CameraCrossingRuleEnvelope,
    summary="Get camera line crossing rule",
)
def get_crossing_rule_endpoint(camera_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            data = get_camera_crossing_rule(cur, camera_id)
    return {"message": "crossing rule loaded", "data": data}


@router.put(
    "/cameras/{camera_id}/crossing-rule",
    response_model=CameraCrossingRuleEnvelope,
    summary="Update camera line crossing rule",
)
def update_crossing_rule_endpoint(
    camera_id: str,
    data: CameraCrossingRuleUpdate,
    user=Depends(require_role(["admin", "hr"])),
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            rule = upsert_camera_crossing_rule(cur, camera_id, data)
            conn.commit()
    return {"message": "crossing rule updated", "data": rule}


@router.post(
    "/internal/camera-crossings",
    response_model=MessageResponse,
    summary="Store AI worker camera crossing event",
)
def create_camera_crossing(
    data: CameraCrossingEventCreate,
    _token=Depends(_require_camera_agent_token),
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            event_id = record_crossing_event(cur, data)
            conn.commit()
    return {"message": f"camera crossing stored: {event_id}"}


@router.post(
    "/internal/camera-room-presence/confirm-exit",
    response_model=MessageResponse,
    summary="Confirm pending room exit after the track disappeared",
)
def confirm_camera_room_presence_exit(
    data: CameraRoomPresenceExitRequest,
    _token=Depends(_require_camera_agent_token),
):
    from services.device_service import parse_datetime_input

    exited_at = parse_datetime_input(data.exited_at) if data.exited_at else None
    with get_connection() as conn:
        with conn.cursor() as cur:
            presence_id = confirm_room_presence_exit(
                cur,
                camera_id=data.camera_id,
                track_id=data.track_id,
                exited_at=exited_at,
            )
            conn.commit()
    return {"message": f"room presence exit confirmed: {presence_id or 'none'}"}


@router.post(
    "/internal/camera-room-presence/cancel-exit",
    response_model=MessageResponse,
    summary="Cancel pending room exit when the track is still visible",
)
def cancel_camera_room_presence_exit(
    data: CameraRoomPresenceCancelExitRequest,
    _token=Depends(_require_camera_agent_token),
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            ids = cancel_room_presence_pending_exit(cur, data.camera_id, data.track_id)
            conn.commit()
    return {"message": f"room presence pending exit cancelled: {len(ids)}"}


@router.get(
    "/camera-room-presence",
    response_model=CameraRoomPresenceListResponse,
    summary="List camera room presence history",
)
def list_camera_room_presence_endpoint(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    employee_id: str | None = Query(None),
    track_id: str | None = Query(None),
    room_id: str | None = Query(None),
    camera_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(require_role(["admin", "hr"])),
):
    df = parse_filter_date(date_from) if date_from else None
    dto = parse_filter_date(date_to, end_of_day=True) if date_to else None
    with get_connection() as conn:
        with conn.cursor() as cur:
            total, data = list_room_presence(
                cur,
                date_from=df,
                date_to=dto,
                employee_id=employee_id,
                track_id=track_id,
                room_id=room_id,
                camera_id=camera_id,
                page=page,
                limit=limit,
            )
    return {"meta": {"page": page, "limit": limit, "total": total}, "data": data}


@router.get(
    "/camera-crossing-events",
    response_model=CameraCrossingEventListResponse,
    summary="List camera entry/exit crossing events",
)
def list_crossing_events_endpoint(
    camera_id: str | None = Query(None),
    room_id: str | None = Query(None),
    employee_id: str | None = Query(None),
    direction: str | None = Query(None, pattern="^(entry|exit)$"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(require_role(["admin", "hr"])),
):
    df = parse_filter_date(date_from) if date_from else None
    dto = parse_filter_date(date_to, end_of_day=True) if date_to else None
    with get_connection() as conn:
        with conn.cursor() as cur:
            total, data = list_crossing_events(
                cur,
                camera_id=camera_id,
                room_id=room_id,
                employee_id=employee_id,
                direction=direction,
                date_from=df,
                date_to=dto,
                page=page,
                limit=limit,
            )
    return {"meta": {"page": page, "limit": limit, "total": total}, "data": data}


@router.post(
    "/camera-crossing-events/{event_id}/link-employee",
    response_model=MessageResponse,
    summary="Link a camera crossing track to an employee",
)
def link_crossing_event_employee(
    event_id: str,
    data: CameraTrackLinkRequest,
    user=Depends(require_role(["admin", "hr"])),
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            result = link_crossing_event_to_employee(cur, event_id, data.employee_id)
            conn.commit()
    return {
        "message": (
            "camera track linked: "
            f"{result['detections_updated']} detections, "
            f"{result['crossings_updated']} crossings"
        )
    }


@router.get(
    "/unknown-detections",
    response_model=UnknownDetectionListResponse,
    summary="List unknown person detections (employee_id IS NULL)",
)
def list_unknown_detections_endpoint(
    camera_id: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    active_only: bool = Query(False, description="Only detections still on camera (disappeared_at IS NULL)"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(require_role(["admin", "hr"])),
):
    from services.device_service import parse_datetime_input

    df = parse_datetime_input(date_from) if date_from else None
    dto = parse_datetime_input(date_to) if date_to else None

    with get_connection() as conn:
        with conn.cursor() as cur:
            total, data = list_unknown_detections(
                cur,
                camera_id=camera_id,
                date_from=df,
                date_to=dto,
                active_only=active_only,
                page=page,
                limit=limit,
            )
    return {"meta": {"page": page, "limit": limit, "total": total}, "data": data}


@router.post(
    "/unknown-detections/{detection_id}/link-employee",
    response_model=MessageResponse,
    summary="Link an unknown camera detection track to an employee",
)
def link_unknown_detection_employee(
    detection_id: str,
    data: CameraTrackLinkRequest,
    user=Depends(require_role(["admin", "hr"])),
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            result = link_unknown_detection_to_employee(cur, detection_id, data.employee_id)
            conn.commit()
    return {
        "message": (
            "camera track linked: "
            f"{result['detections_updated']} detections, "
            f"{result['crossings_updated']} crossings"
        )
    }


@router.get(
    "/cameras/live-unknown-detections",
    response_model=LiveUnknownDetectionsResponse,
    summary="Latest active unknown detections per camera track",
)
def get_live_unknown_detections(user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            data = live_unknown_per_camera(cur)
    return {"data": data}


@router.get(
    "/cameras/live-matched-detections",
    response_model=LiveMatchedDetectionsResponse,
    summary="Latest active matched (identified) detections per camera track",
)
def get_live_matched_detections(user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            data = live_matched_per_camera(cur)
    return {"data": data}


@router.get(
    "/internal/cameras/active",
    summary="List camera stream configs for GPU worker",
)
def list_internal_active_cameras(_token=Depends(_require_camera_agent_token)):
    secret = camera_credential_secret()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    c.id,
                    c.name,
                    c.ip,
                    c.username,
                    CASE
                        WHEN c.password_encrypted IS NULL THEN NULL
                        ELSE pgp_sym_decrypt(c.password_encrypted, %s)
                    END AS password,
                    c.rtsp_main_url,
                    c.rtsp_sub_url,
                    c.isapi_base_url,
                    c.zone_id,
                    z.name,
                    z.type,
                    c.room_id,
                    c.has_audio,
                    c.has_speaker,
                    ccr.id,
                    ccr.name,
                    ccr.enabled,
                    ccr.line_x1,
                    ccr.line_y1,
                    ccr.line_x2,
                    ccr.line_y2,
                    ccr.entry_direction,
                    ccr.created_at,
                    ccr.updated_at
                FROM cameras c
                JOIN zones z ON z.id = c.zone_id
                LEFT JOIN camera_crossing_rules ccr ON ccr.camera_id = c.id
                WHERE c.status <> 'offline'
                ORDER BY c.created_at ASC
                """,
                (secret,),
            )
            rows = cur.fetchall()
    return {
        "data": [
            {
                "id": str(row[0]),
                "name": row[1],
                "ip": row[2],
                "username": row[3],
                "rtsp_main_url": inject_rtsp_credentials(row[5], row[3], row[4]),
                "rtsp_sub_url": inject_rtsp_credentials(row[6], row[3], row[4]) if row[6] else None,
                "isapi_base_url": row[7],
                "zone_id": str(row[8]),
                "zone_name": row[9],
                "zone_type": row[10],
                "room_id": str(row[11]) if row[11] else None,
                "has_audio": bool(row[12]),
                "has_speaker": bool(row[13]),
                "crossing_rule": {
                    "id": str(row[14]),
                    "camera_id": str(row[0]),
                    "name": row[15],
                    "enabled": bool(row[16]),
                    "line_x1": float(row[17]),
                    "line_y1": float(row[18]),
                    "line_x2": float(row[19]),
                    "line_y2": float(row[20]),
                    "entry_direction": row[21],
                    "created_at": str(row[22]) if row[22] else None,
                    "updated_at": str(row[23]) if row[23] else None,
                }
                if row[14]
                else None,
            }
            for row in rows
        ]
    }


@router.post(
    "/internal/face-embeddings",
    response_model=MessageResponse,
    summary="Store an employee face embedding (enrollment)",
)
def store_face_embedding_endpoint(
    data: FaceEmbeddingStoreRequest,
    _token=Depends(_require_camera_agent_token),
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            embedding_id = store_face_embedding(cur, data)
            conn.commit()
    return {"message": f"face embedding stored: {embedding_id}"}


@router.get(
    "/internal/face-embeddings",
    response_model=FaceEmbeddingListResponse,
    summary="List all employee face embeddings for the GPU worker",
)
def list_face_embeddings_endpoint(_token=Depends(_require_camera_agent_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            data = list_face_embeddings(cur)
    return {"data": data}


@router.get(
    "/internal/employees/pending-enrollment",
    response_model=PendingEnrollmentListResponse,
    summary="List active employees with a photo but no face embedding yet",
)
def list_pending_enrollment_endpoint(_token=Depends(_require_camera_agent_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            data = list_pending_enrollment(cur)
    return {"data": data}


@router.websocket("/ws/employee-location")
async def websocket_employee_location(websocket: WebSocket, token: str | None = Query(None)):
    if not token:
        await websocket.close(code=1008)
        return
    try:
        user = _decode_token(token)
        role = (user.get("role") or "").lower()
        if role not in {"superadmin", "admin", "hr"}:
            await websocket.close(code=1008)
            return
    except Exception:
        await websocket.close(code=1008)
        return

    await location_connections.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        location_connections.disconnect(websocket)
