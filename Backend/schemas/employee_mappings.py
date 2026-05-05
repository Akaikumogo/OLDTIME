from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
import uuid


class EmployeeDeviceMappingCreate(BaseModel):
    employee_id: uuid.UUID
    card_id: str = Field(..., min_length=1, max_length=255)
    device_serial_no: Optional[str] = None


class EmployeeDeviceMappingResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    card_id: str
    device_serial_no: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class EmployeeDeviceMappingUpdate(BaseModel):
    card_id: Optional[str] = Field(None, min_length=1, max_length=255)
    device_serial_no: Optional[str] = None
    is_active: Optional[bool] = None
