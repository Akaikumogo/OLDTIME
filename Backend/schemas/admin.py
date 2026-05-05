from typing import Optional

from pydantic import BaseModel


class AdminCreate(BaseModel):
    full_name: str
    username: str
    email: str
    password: str


class AdminUpdate(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class AdminResponse(BaseModel):
    id: str
    full_name: str
    username: str
    email: str
    role: str
    is_active: bool
    created_at: str


class AdminListMeta(BaseModel):
    total_items: int
    total_pages: int
    current_page: int
    limit: int
    has_next: bool
    has_prev: bool
    next_page: int | None
    prev_page: int | None


class AdminListResponse(BaseModel):
    meta: AdminListMeta
    data: list[AdminResponse]


class AdminEnvelope(BaseModel):
    message: str
    admin: AdminResponse
