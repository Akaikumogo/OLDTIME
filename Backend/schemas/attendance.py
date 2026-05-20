from typing import Literal, Optional

from pydantic import BaseModel, Field


DoorEventType = Literal["entry", "exit"]
AttendanceStatus = Literal[
    "on_time",
    "late",
    "entry",
    "exit",
    "lunch_out",
    "lunch_return",
    "early_exit",
    "on_time_exit",
    "unmatched_employee",
    "ambiguous_employee",
    "holiday",
    "weekend",
]
MatchStatus = Literal["matched", "unmatched", "ambiguous"]
PermissionStatus = Literal["pending", "approved", "rejected"]
PermissionType = Literal["task", "business_trip", "personal_permission", "medical", "other"]


class DoorCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    ip_address: str = Field(..., min_length=7, max_length=255)
    event_type: DoorEventType
    is_active: bool = True


class DoorUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    ip_address: Optional[str] = Field(None, min_length=7, max_length=255)
    event_type: Optional[DoorEventType] = None
    is_active: Optional[bool] = None


class DoorResponse(BaseModel):
    id: str
    name: str
    ip_address: str
    event_type: DoorEventType
    is_active: bool
    created_at: str
    connection_status: Optional[str] = "unknown"
    last_checked_at: Optional[str] = None
    last_success_at: Optional[str] = None
    last_error: Optional[str] = None


class DoorListMeta(BaseModel):
    page: int
    limit: int
    total: int


class DoorListResponse(BaseModel):
    meta: DoorListMeta
    data: list[DoorResponse]


class DoorEnvelope(BaseModel):
    message: str
    data: DoorResponse


class AttendancePolicyUpsert(BaseModel):
    work_start_time: str = Field(..., description="HH:MM")
    work_end_time: str = Field(..., description="HH:MM")
    lunch_start_time: Optional[str] = Field(None, description="HH:MM")
    lunch_end_time: Optional[str] = Field(None, description="HH:MM")
    late_grace_minutes: int = Field(0, ge=0, le=180)
    early_leave_grace_minutes: int = Field(0, ge=0, le=180)
    is_active: bool = True


class AttendancePolicyResponse(BaseModel):
    id: int
    work_start_time: str
    work_end_time: str
    lunch_start_time: Optional[str]
    lunch_end_time: Optional[str]
    late_grace_minutes: int
    early_leave_grace_minutes: int
    is_active: bool
    created_at: str
    updated_at: str


class AttendancePolicyEnvelope(BaseModel):
    message: str
    data: AttendancePolicyResponse


class AttendancePolicyGetResponse(BaseModel):
    data: Optional[AttendancePolicyResponse] = None


class AttendanceEventCreate(BaseModel):
    door_id: str
    employee_name: str = Field(..., min_length=1, max_length=255)
    event_timestamp: str
    card_id: Optional[str] = Field(None, max_length=255)
    serial_no: Optional[str] = None
    picture_path: Optional[str] = None


class AttendanceEventUpdate(BaseModel):
    door_id: Optional[str] = None
    employee_name: Optional[str] = Field(None, min_length=1, max_length=255)
    event_timestamp: Optional[str] = None
    card_id: Optional[str] = Field(None, max_length=255)
    picture_path: Optional[str] = None
    status: Optional[AttendanceStatus] = None


class AttendanceEventDoorRef(BaseModel):
    id: str
    name: str
    ip_address: str
    event_type: DoorEventType


class AttendanceEventEmployeeRef(BaseModel):
    id: Optional[str]
    full_name: str


class AttendanceEventResponse(BaseModel):
    id: str
    card_id: Optional[str]
    serial_no: Optional[str]
    event_timestamp: str
    status: AttendanceStatus
    match_status: MatchStatus
    picture_path: Optional[str]
    picture_url: Optional[str] = None
    created_at: str
    employee: AttendanceEventEmployeeRef
    door: AttendanceEventDoorRef


class AttendanceEventListMeta(BaseModel):
    page: int
    limit: int
    total: int


class AttendanceEventListResponse(BaseModel):
    meta: AttendanceEventListMeta
    data: list[AttendanceEventResponse]


class AttendanceDailyMarker(BaseModel):
    type: DoorEventType
    label: str
    time: str
    full_time: str
    status: AttendanceStatus
    color: str
    door_name: str


class AttendanceDailySegment(BaseModel):
    type: str
    label: str
    start: str
    end: str
    start_full: str
    end_full: str
    color: str
    reason: Optional[str] = None


class AttendanceDailyEmployeeRef(BaseModel):
    id: str
    full_name: str


class AttendanceDailyRow(BaseModel):
    id: str
    date: str
    employee: AttendanceDailyEmployeeRef
    first_entry: Optional[str] = None
    first_entry_full: Optional[str] = None
    last_exit: Optional[str] = None
    last_exit_full: Optional[str] = None
    statuses: list[AttendanceStatus]
    markers: list[AttendanceDailyMarker]
    segments: list[AttendanceDailySegment]
    computer_activity_count: int = 0
    computer_seconds: int = 0
    top_apps: list[str] = Field(default_factory=list)
    top_sites: list[str] = Field(default_factory=list)


class AttendanceDailyListResponse(BaseModel):
    meta: AttendanceEventListMeta
    data: list[AttendanceDailyRow]


class AttendanceEventEnvelope(BaseModel):
    message: str
    data: AttendanceEventResponse


class HikvisionPollerStatusResponse(BaseModel):
    running: bool
    poll_interval_seconds: int
    active_doors: int
    last_tick_at: Optional[str] = None
    last_error: Optional[str] = None


class WorkPermissionCreate(BaseModel):
    employee_id: str
    permission_date: str = Field(..., description="YYYY-MM-DD or DD.MM.YYYY")
    start_time: str = Field(..., description="HH:MM")
    end_time: str = Field(..., description="HH:MM")
    reason: str = Field(..., min_length=1)
    permission_type: PermissionType = "task"
    status: PermissionStatus = "approved"


class WorkPermissionUpdate(BaseModel):
    permission_date: Optional[str] = Field(None, description="YYYY-MM-DD or DD.MM.YYYY")
    start_time: Optional[str] = Field(None, description="HH:MM")
    end_time: Optional[str] = Field(None, description="HH:MM")
    reason: Optional[str] = Field(None, min_length=1)
    permission_type: Optional[PermissionType] = None
    status: Optional[PermissionStatus] = None


class WorkPermissionEmployeeRef(BaseModel):
    id: str
    full_name: str


class WorkPermissionResponse(BaseModel):
    id: str
    permission_date: str
    start_time: str
    end_time: str
    reason: str
    permission_type: PermissionType
    status: PermissionStatus
    created_at: str
    employee: WorkPermissionEmployeeRef


class WorkPermissionEnvelope(BaseModel):
    message: str
    data: WorkPermissionResponse


class WorkPermissionListResponse(BaseModel):
    meta: AttendanceEventListMeta
    data: list[WorkPermissionResponse]


class ReportSummaryResponse(BaseModel):
    date_from: str
    date_to: str
    total_events: int
    active_employees: int
    on_time: int
    late: int
    early_exit: int
    on_time_exit: int
    lunch_out: int
    lunch_return: int
    unmatched: int
    ambiguous: int
    permissions: int


class TimelineSegment(BaseModel):
    type: str
    label: str
    start: str
    end: str
    color: str
    reason: Optional[str] = None


class TimelineMarker(BaseModel):
    type: str
    label: str
    time: str
    status: str
    color: str
    door_name: str


class ComputerTimelineActivity(BaseModel):
    id: str
    app_name: str
    window_title: Optional[str] = None
    url: Optional[str] = None
    started_at: str
    ended_at: str
    duration_seconds: int
    color: str
    category: str


class EmployeeTimelineSummary(BaseModel):
    first_entry: Optional[str] = None
    last_exit: Optional[str] = None
    attendance_event_count: int
    attendance_segment_count: int
    permission_segment_count: int
    computer_activity_count: int
    work_seconds: int
    permission_seconds: int
    computer_seconds: int


class EmployeeTimelineResponse(BaseModel):
    employee: WorkPermissionEmployeeRef
    date: str
    segments: list[TimelineSegment]
    markers: list[TimelineMarker]
    computer_activity: list[ComputerTimelineActivity] = Field(default_factory=list)
    summary: Optional[EmployeeTimelineSummary] = None
