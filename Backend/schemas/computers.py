from typing import Optional

from pydantic import BaseModel, Field


class ComputerHeartbeat(BaseModel):
    hostname: str = Field(..., min_length=1, max_length=255)
    mac_address: str = Field(..., min_length=5, max_length=64)
    ip_address: Optional[str] = Field(None, max_length=64)
    os_name: Optional[str] = Field(None, max_length=255)
    agent_version: Optional[str] = Field(None, max_length=50)
    employee_id: Optional[str] = None


class ComputerAssign(BaseModel):
    employee_id: Optional[str] = None


class ComputerCreate(BaseModel):
    hostname: str = Field(..., min_length=1, max_length=255)
    mac_address: str = Field(..., min_length=5, max_length=64)
    ip_address: Optional[str] = Field(None, max_length=64)
    os_name: Optional[str] = Field(None, max_length=255)
    agent_version: Optional[str] = Field(None, max_length=50)
    employee_id: Optional[str] = None
    is_active: bool = True


class ComputerUpdate(BaseModel):
    hostname: Optional[str] = Field(None, min_length=1, max_length=255)
    mac_address: Optional[str] = Field(None, min_length=5, max_length=64)
    ip_address: Optional[str] = Field(None, max_length=64)
    os_name: Optional[str] = Field(None, max_length=255)
    agent_version: Optional[str] = Field(None, max_length=50)
    employee_id: Optional[str] = None
    is_active: Optional[bool] = None


class ComputerRef(BaseModel):
    id: str
    hostname: str
    mac_address: str
    ip_address: Optional[str]
    os_name: Optional[str]
    agent_version: Optional[str]
    is_active: bool
    last_seen_at: Optional[str]
    created_at: str
    connection_status: str = "unknown"
    employee: Optional[dict] = None


class ComputerListMeta(BaseModel):
    page: int
    limit: int
    total: int


class ComputerListResponse(BaseModel):
    meta: ComputerListMeta
    data: list[ComputerRef]


class ComputerEnvelope(BaseModel):
    message: str
    data: ComputerRef


class ComputerActivityCreate(BaseModel):
    app_name: str = Field(..., min_length=1, max_length=255)
    window_title: Optional[str] = None
    url: Optional[str] = None
    started_at: str
    ended_at: str
    duration_seconds: int = Field(..., ge=0)


class ComputerActivityBatch(BaseModel):
    mac_address: str = Field(..., min_length=5, max_length=64)
    events: list[ComputerActivityCreate]
    employee_id: Optional[str] = None


class ComputerActivityResponse(BaseModel):
    id: str
    computer_id: str
    employee_id: Optional[str]
    app_name: str
    window_title: Optional[str]
    url: Optional[str]
    started_at: str
    ended_at: str
    duration_seconds: int
    created_at: str


class ComputerActivityListResponse(BaseModel):
    meta: ComputerListMeta
    data: list[ComputerActivityResponse]


class ComputerUsageStat(BaseModel):
    name: str
    duration_seconds: int
    events: int


class ComputerAnalyticsResponse(BaseModel):
    date_from: str
    date_to: str
    total_duration_seconds: int
    active_computers: int
    online_computers: int
    offline_computers: int
    top_apps: list[ComputerUsageStat]
    top_sites: list[ComputerUsageStat]
    recent_activity: list[ComputerActivityResponse]
