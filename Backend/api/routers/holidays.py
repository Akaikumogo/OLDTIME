"""Bayramlar / dam olish kunlari uchun endpointlar."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from db import get_connection
from schemas.common import MessageResponse
from schemas.holidays import (
    HolidayCreate,
    HolidayEnvelope,
    HolidayListResponse,
    HolidayUpdate,
)
from services.event_service import parse_date_only
from utils.auth import require_role

router = APIRouter(tags=["Holidays"])


def _serialize(row) -> dict:
    return {
        "id": str(row[0]),
        "date": str(row[1]),
        "name": row[2],
        "type": row[3],
        "is_paid": bool(row[4]),
    }


@router.post(
    "/holidays",
    response_model=HolidayEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create holiday",
)
def create_holiday(data: HolidayCreate, user=Depends(require_role(["admin", "hr"]))):
    holiday_date = parse_date_only(data.holiday_date)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM holidays WHERE holiday_date = %s", (holiday_date,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Holiday for this date already exists")
            cur.execute(
                """
                INSERT INTO holidays (holiday_date, name, holiday_type, is_paid)
                VALUES (%s, %s, %s, %s)
                RETURNING id, holiday_date, name, holiday_type, is_paid
                """,
                (holiday_date, data.name, data.holiday_type, data.is_paid),
            )
            row = cur.fetchone()
            conn.commit()
    return {"message": "holiday created", "data": _serialize(row)}


@router.get("/holidays", response_model=HolidayListResponse, summary="List holidays")
def list_holidays(
    year: Optional[int] = None,
    holiday_type: Optional[str] = None,
    user=Depends(require_role(["admin", "hr"])),
):
    filters = []
    params: list = []
    if year:
        filters.append("EXTRACT(YEAR FROM holiday_date) = %s")
        params.append(year)
    if holiday_type:
        filters.append("holiday_type = %s")
        params.append(holiday_type)
    where = f" WHERE {' AND '.join(filters)}" if filters else ""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, holiday_date, name, holiday_type, is_paid
                FROM holidays
                {where}
                ORDER BY holiday_date ASC
                """,
                params,
            )
            rows = cur.fetchall()
    return {"data": [_serialize(row) for row in rows]}


@router.patch("/holidays/{holiday_id}", response_model=HolidayEnvelope, summary="Update holiday")
def update_holiday(holiday_id: str, data: HolidayUpdate, user=Depends(require_role(["admin", "hr"]))):
    update_fields = []
    values: list = []
    provided = data.model_dump(exclude_unset=True)
    for key in ("name", "holiday_type", "is_paid"):
        if key in provided:
            update_fields.append(f"{key} = %s")
            values.append(provided[key])
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nothing to update")
    values.append(holiday_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE holidays
                SET {", ".join(update_fields)}
                WHERE id = %s
                RETURNING id, holiday_date, name, holiday_type, is_paid
                """,
                values,
            )
            row = cur.fetchone()
            conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Holiday not found")
    return {"message": "holiday updated", "data": _serialize(row)}


@router.delete("/holidays/{holiday_id}", response_model=MessageResponse, summary="Delete holiday")
def delete_holiday(holiday_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM holidays WHERE id = %s RETURNING id", (holiday_id,))
            deleted = cur.fetchone()
            conn.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Holiday not found")
    return {"message": "holiday deleted"}
