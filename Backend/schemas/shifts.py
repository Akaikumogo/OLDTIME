from typing import Optional

from pydantic import BaseModel, Field


class ShiftCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    start_time: str = Field(..., description="HH:MM")
    end_time: str = Field(..., description="HH:MM")
    is_overnight: bool = False
    lunch_start_time: Optional[str] = Field(None, description="HH:MM")
    lunch_end_time: Optional[str] = Field(None, description="HH:MM")
    late_grace_minutes: int = Field(0, ge=0, le=180)
    early_leave_grace_minutes: int = Field(0, ge=0, le=180)
    work_days: list[str] = Field(default_factory=lambda: ["mon", "tue", "wed", "thu", "fri"])
    is_active: bool = True


class ShiftUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_overnight: Optional[bool] = None
    lunch_start_time: Optional[str] = None
    lunch_end_time: Optional[str] = None
    late_grace_minutes: Optional[int] = Field(None, ge=0, le=180)
    early_leave_grace_minutes: Optional[int] = Field(None, ge=0, le=180)
    work_days: Optional[list[str]] = None
    is_active: Optional[bool] = None


class ShiftResponse(BaseModel):
    id: str
    name: str
    start_time: str
    end_time: str
    is_overnight: bool
    lunch_start_time: Optional[str] = None
    lunch_end_time: Optional[str] = None
    late_grace_minutes: int
    early_leave_grace_minutes: int
    work_days: list[str]
    is_active: bool
    created_at: Optional[str] = None


class ShiftEnvelope(BaseModel):
    message: str
    data: ShiftResponse


class ShiftListResponse(BaseModel):
    data: list[ShiftResponse]


class EmployeeShiftAssign(BaseModel):
    employee_id: str
    shift_id: str
    effective_from: str = Field(..., description="YYYY-MM-DD")
    effective_to: Optional[str] = None


class EmployeeShiftResponse(BaseModel):
    id: str
    employee: dict
    shift: dict
    effective_from: str
    effective_to: Optional[str] = None
    created_at: str


class EmployeeShiftEnvelope(BaseModel):
    message: str
    data: EmployeeShiftResponse


class EmployeeShiftListResponse(BaseModel):
    data: list[EmployeeShiftResponse]
