from typing import Literal, Optional

from pydantic import BaseModel, Field

HolidayTypeLiteral = Literal["public", "company", "weekend"]


class HolidayCreate(BaseModel):
    holiday_date: str = Field(..., description="YYYY-MM-DD or DD.MM.YYYY")
    name: str = Field(..., min_length=1, max_length=255)
    holiday_type: HolidayTypeLiteral = "public"
    is_paid: bool = True


class HolidayUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    holiday_type: Optional[HolidayTypeLiteral] = None
    is_paid: Optional[bool] = None


class HolidayResponse(BaseModel):
    id: str
    date: str
    name: str
    type: HolidayTypeLiteral
    is_paid: bool


class HolidayEnvelope(BaseModel):
    message: str
    data: HolidayResponse


class HolidayListResponse(BaseModel):
    data: list[HolidayResponse]
