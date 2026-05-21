from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ZoneType(str, Enum):
    WORK_ROOM = "WORK_ROOM"
    CORRIDOR = "CORRIDOR"
    REST_ZONE = "REST_ZONE"
    MEETING_ROOM = "MEETING_ROOM"
    ENTRANCE = "ENTRANCE"
    EXIT = "EXIT"
    UNKNOWN = "UNKNOWN"


class CameraStatus(str, Enum):
    online = "online"
    offline = "offline"
    error = "error"
    testing = "testing"
    unknown = "unknown"


class DetectionType(str, Enum):
    FACE = "FACE"
    BODY = "BODY"
    FACE_BODY = "FACE_BODY"


class ZoneCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: ZoneType = ZoneType.UNKNOWN
    productivity_weight: float = 0
    timeout_seconds: int = Field(0, ge=0)


class ZoneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[ZoneType] = None
    productivity_weight: Optional[float] = None
    timeout_seconds: Optional[int] = Field(None, ge=0)


class ZoneResponse(BaseModel):
    id: str
    name: str
    type: ZoneType
    productivity_weight: float
    timeout_seconds: int
    created_at: str
    camera_count: int = 0


class ZoneEnvelope(BaseModel):
    message: str
    data: ZoneResponse


class ZoneListResponse(BaseModel):
    data: list[ZoneResponse]


class RoomCameraInput(BaseModel):
    camera_id: str
    is_primary: bool = False
    view_position: Optional[str] = Field(None, max_length=80)


class RoomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    department_id: Optional[str] = None
    floor: Optional[str] = Field(None, max_length=64)
    description: Optional[str] = None
    cameras: list[RoomCameraInput] = Field(default_factory=list)


class RoomUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    department_id: Optional[str] = None
    floor: Optional[str] = Field(None, max_length=64)
    description: Optional[str] = None
    cameras: Optional[list[RoomCameraInput]] = None


class CameraMini(BaseModel):
    id: str
    name: str
    ip: str
    status: CameraStatus
    zone_id: str
    zone_name: str
    has_audio: bool
    has_speaker: bool
    is_primary: bool = False
    view_position: Optional[str] = None
    stream_url: str


class RoomResponse(BaseModel):
    id: str
    name: str
    department_id: Optional[str]
    department_name: Optional[str]
    floor: Optional[str]
    description: Optional[str]
    created_at: str
    cameras: list[CameraMini] = Field(default_factory=list)


class RoomEnvelope(BaseModel):
    message: str
    data: RoomResponse


class RoomListResponse(BaseModel):
    data: list[RoomResponse]


class CameraCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    ip: str = Field(..., min_length=1, max_length=64)
    username: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=1, max_length=255)
    rtsp_main_url: str = Field(..., min_length=1)
    rtsp_sub_url: Optional[str] = None
    isapi_base_url: Optional[str] = None
    zone_id: str
    room_id: Optional[str] = None
    has_audio: bool = False
    has_speaker: bool = False
    status: CameraStatus = CameraStatus.unknown


class CameraUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    ip: Optional[str] = Field(None, min_length=1, max_length=64)
    username: Optional[str] = Field(None, min_length=1, max_length=255)
    password: Optional[str] = Field(None, min_length=1, max_length=255)
    rtsp_main_url: Optional[str] = Field(None, min_length=1)
    rtsp_sub_url: Optional[str] = None
    isapi_base_url: Optional[str] = None
    zone_id: Optional[str] = None
    room_id: Optional[str] = None
    has_audio: Optional[bool] = None
    has_speaker: Optional[bool] = None
    status: Optional[CameraStatus] = None


class CameraResponse(BaseModel):
    id: str
    name: str
    ip: str
    username: str
    password_configured: bool
    rtsp_main_url: str
    rtsp_sub_url: Optional[str]
    isapi_base_url: Optional[str]
    zone_id: str
    zone_name: str
    zone_type: ZoneType
    room_id: Optional[str]
    room_name: Optional[str]
    has_audio: bool
    has_speaker: bool
    status: CameraStatus
    last_checked_at: Optional[str]
    last_error: Optional[str]
    created_at: str
    updated_at: str
    stream_url: str
    audio_url: str


class CameraEnvelope(BaseModel):
    message: str
    data: CameraResponse


class CameraListMeta(BaseModel):
    page: int
    limit: int
    total: int


class CameraListResponse(BaseModel):
    meta: CameraListMeta
    data: list[CameraResponse]


class CameraTestResponse(BaseModel):
    camera_id: str
    status: CameraStatus
    message: str
    snapshot_url: Optional[str] = None
    has_audio: bool
    has_speaker: bool


class CameraTalkRequest(BaseModel):
    action: str = Field(..., pattern="^(start|stop)$")


class CameraTalkResponse(BaseModel):
    camera_id: str
    status: str
    message: str
    talkback_url: Optional[str] = None


class EmployeeRoomAssignmentRequest(BaseModel):
    assigned_room_id: str


class EmployeeCameraAssignmentResponse(BaseModel):
    id: str
    employee_id: str
    assigned_room_id: str
    assigned_camera_id: Optional[str]
    created_at: str
    updated_at: str
    room: RoomResponse


class CameraDetectionCreate(BaseModel):
    camera_id: str
    employee_id: Optional[str] = None
    track_id: str = Field(..., min_length=1, max_length=120)
    detection_type: DetectionType
    confidence: float = Field(..., ge=0, le=1)
    bbox: Optional[dict[str, Any]] = None
    seen_at: Optional[str] = None
    disappeared_at: Optional[str] = None
    duration_seconds: Optional[int] = Field(None, ge=0)
    snapshot_path: Optional[str] = None


class EmployeeLocationEvent(BaseModel):
    employee_id: str
    active_camera_id: Optional[str]
    active_zone_id: Optional[str]
    assigned_camera_id: Optional[str]
    is_visible: bool
    inferred: bool
    last_seen_at: Optional[str]
    detection_type: Optional[DetectionType]
    confidence: Optional[float]


class EmployeeLiveLocationResponse(EmployeeLocationEvent):
    employee: dict[str, Any]
    active_camera: Optional[CameraResponse]
    active_zone: Optional[ZoneResponse]
    active_room: Optional[RoomResponse]
    assigned_room: Optional[RoomResponse]
    assigned_cameras: list[CameraMini] = Field(default_factory=list)
    inferred_zone_id: Optional[str] = None
    updated_at: Optional[str] = None


class EmployeeCameraViewsResponse(BaseModel):
    employee_id: str
    active_camera: Optional[CameraResponse]
    assigned_room_camera: Optional[CameraResponse]
    assigned_room_cameras: list[CameraMini] = Field(default_factory=list)


class LocationTimelineItem(BaseModel):
    id: str
    camera_id: str
    camera_name: str
    zone_id: str
    zone_name: str
    zone_type: ZoneType
    room_id: Optional[str]
    room_name: Optional[str]
    detection_type: DetectionType
    confidence: float
    track_id: str
    seen_at: str
    disappeared_at: Optional[str]
    duration_seconds: Optional[int]
    snapshot_path: Optional[str]


class LocationTimelineResponse(BaseModel):
    data: list[LocationTimelineItem]


class CameraProductivityBreakdown(BaseModel):
    assigned_room_visible_seconds: int
    work_zone_visible_seconds: int
    rest_zone_seconds: int
    corridor_seconds: int
    unknown_seconds: int
    not_visible_seconds: int
    inferred_zone_seconds: int
    productivity_score: float


class EmployeeLocationStateRow(EmployeeLiveLocationResponse):
    pass


class EmployeeLocationStateListResponse(BaseModel):
    data: list[EmployeeLocationStateRow]


class UnknownDetectionItem(BaseModel):
    id: str
    camera_id: str
    camera_name: str
    camera_ip: str
    zone_id: str
    zone_name: str
    room_id: Optional[str]
    room_name: Optional[str]
    track_id: str
    detection_type: DetectionType
    confidence: float
    seen_at: str
    disappeared_at: Optional[str]
    duration_seconds: Optional[int]
    snapshot_path: Optional[str]
    bbox: Optional[dict]


class UnknownDetectionListMeta(BaseModel):
    page: int
    limit: int
    total: int


class UnknownDetectionListResponse(BaseModel):
    meta: UnknownDetectionListMeta
    data: list[UnknownDetectionItem]


class LiveUnknownDetection(BaseModel):
    id: str
    camera_id: str
    track_id: str
    detection_type: DetectionType
    confidence: float
    seen_at: str
    snapshot_path: Optional[str]


class LiveUnknownDetectionsResponse(BaseModel):
    data: list[LiveUnknownDetection]
