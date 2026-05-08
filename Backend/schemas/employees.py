from typing import Optional

from pydantic import BaseModel, Field


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)


class PositionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class PositionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)


class EmployeeCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    department_id: str
    position_id: str
    employee_code: Optional[str] = Field(None, max_length=64, description="Unikal tabel raqami yoki Hikvision card ID")
    is_active: bool = True


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    department_id: Optional[str] = None
    position_id: Optional[str] = None
    employee_code: Optional[str] = Field(None, max_length=64)
    is_active: Optional[bool] = None


class DepartmentResponse(BaseModel):
    id: str
    name: str
    created_at: str


class DepartmentListResponse(BaseModel):
    data: list[DepartmentResponse]


class DepartmentEnvelope(BaseModel):
    message: str
    data: DepartmentResponse


class PositionResponse(BaseModel):
    id: str
    name: str
    created_at: str


class PositionListResponse(BaseModel):
    data: list[PositionResponse]


class PositionEnvelope(BaseModel):
    message: str
    data: PositionResponse


class EmployeeDepartmentRef(BaseModel):
    id: str
    name: str


class EmployeePositionRef(BaseModel):
    id: str
    name: str


class EmployeeResponse(BaseModel):
    id: str
    full_name: str
    employee_code: Optional[str] = None
    photo_url: Optional[str] = None
    is_active: bool
    created_at: str
    department: EmployeeDepartmentRef
    position: EmployeePositionRef


class EmployeeListMeta(BaseModel):
    page: int
    limit: int
    total: int


class EmployeeListResponse(BaseModel):
    meta: EmployeeListMeta
    data: list[EmployeeResponse]


class EmployeeEnvelope(BaseModel):
    message: str
    data: EmployeeResponse
