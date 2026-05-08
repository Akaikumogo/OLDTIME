"""Smenalar va xodim-smena bog'lanishi uchun endpointlar."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from db import get_connection
from schemas.common import MessageResponse
from schemas.shifts import (
    EmployeeShiftAssign,
    EmployeeShiftEnvelope,
    EmployeeShiftListResponse,
    EmployeeShiftResponse,
    ShiftCreate,
    ShiftEnvelope,
    ShiftListResponse,
    ShiftUpdate,
)
from services.event_service import parse_date_only
from services.shifts_service import serialize_shift
from utils.auth import require_role

router = APIRouter(tags=["Shifts"])


def _select_shift():
    return """
        SELECT id, name, start_time, end_time, is_overnight,
               lunch_start_time, lunch_end_time,
               late_grace_minutes, early_leave_grace_minutes,
               work_days, is_active, created_at
        FROM shifts
    """


def _select_employee_shift():
    return """
        SELECT es.id, es.effective_from, es.effective_to, es.created_at,
               e.id, e.full_name,
               s.id, s.name, s.start_time, s.end_time, s.is_overnight,
               s.lunch_start_time, s.lunch_end_time,
               s.late_grace_minutes, s.early_leave_grace_minutes,
               s.work_days, s.is_active
        FROM employee_shifts es
        JOIN employees e ON e.id = es.employee_id
        JOIN shifts s ON s.id = es.shift_id
    """


def _serialize_employee_shift(row) -> dict:
    return {
        "id": str(row[0]),
        "effective_from": str(row[1]),
        "effective_to": str(row[2]) if row[2] else None,
        "created_at": str(row[3]),
        "employee": {"id": str(row[4]), "full_name": row[5]},
        "shift": {
            "id": str(row[6]),
            "name": row[7],
            "start_time": str(row[8])[:5],
            "end_time": str(row[9])[:5],
            "is_overnight": bool(row[10]),
            "lunch_start_time": str(row[11])[:5] if row[11] else None,
            "lunch_end_time": str(row[12])[:5] if row[12] else None,
            "late_grace_minutes": row[13] or 0,
            "early_leave_grace_minutes": row[14] or 0,
            "work_days": list(row[15]) if row[15] else [],
            "is_active": bool(row[16]),
        },
    }


@router.post("/shifts", response_model=ShiftEnvelope, status_code=status.HTTP_201_CREATED, summary="Create shift")
def create_shift(data: ShiftCreate, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM shifts WHERE name = %s", (data.name,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Shift with this name already exists")
            cur.execute(
                """
                INSERT INTO shifts (
                    name, start_time, end_time, is_overnight,
                    lunch_start_time, lunch_end_time,
                    late_grace_minutes, early_leave_grace_minutes,
                    work_days, is_active
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, name, start_time, end_time, is_overnight,
                          lunch_start_time, lunch_end_time,
                          late_grace_minutes, early_leave_grace_minutes,
                          work_days, is_active, created_at
                """,
                (
                    data.name,
                    data.start_time,
                    data.end_time,
                    data.is_overnight,
                    data.lunch_start_time,
                    data.lunch_end_time,
                    data.late_grace_minutes,
                    data.early_leave_grace_minutes,
                    data.work_days,
                    data.is_active,
                ),
            )
            row = cur.fetchone()
            conn.commit()
    return {"message": "shift created", "data": serialize_shift(row)}


@router.get("/shifts", response_model=ShiftListResponse, summary="List shifts")
def list_shifts(
    is_active: Optional[bool] = None,
    user=Depends(require_role(["admin", "hr"])),
):
    filters = []
    params: list = []
    if is_active is not None:
        filters.append("is_active = %s")
        params.append(is_active)
    where = f" WHERE {' AND '.join(filters)}" if filters else ""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(_select_shift() + where + " ORDER BY name ASC", params)
            rows = cur.fetchall()
    return {"data": [serialize_shift(row) for row in rows]}


@router.patch("/shifts/{shift_id}", response_model=ShiftEnvelope, summary="Update shift")
def update_shift(shift_id: str, data: ShiftUpdate, user=Depends(require_role(["admin", "hr"]))):
    update_fields = []
    values: list = []
    field_map = {
        "name": "name",
        "start_time": "start_time",
        "end_time": "end_time",
        "is_overnight": "is_overnight",
        "lunch_start_time": "lunch_start_time",
        "lunch_end_time": "lunch_end_time",
        "late_grace_minutes": "late_grace_minutes",
        "early_leave_grace_minutes": "early_leave_grace_minutes",
        "work_days": "work_days",
        "is_active": "is_active",
    }
    provided = data.model_dump(exclude_unset=True)
    for key, column in field_map.items():
        if key in provided:
            update_fields.append(f"{column} = %s")
            values.append(provided[key])
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nothing to update")
    values.append(shift_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE shifts
                SET {", ".join(update_fields)}, updated_at = NOW()
                WHERE id = %s
                RETURNING id, name, start_time, end_time, is_overnight,
                          lunch_start_time, lunch_end_time,
                          late_grace_minutes, early_leave_grace_minutes,
                          work_days, is_active, created_at
                """,
                values,
            )
            row = cur.fetchone()
            conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Shift not found")
    return {"message": "shift updated", "data": serialize_shift(row)}


@router.delete("/shifts/{shift_id}", response_model=MessageResponse, summary="Delete shift")
def delete_shift(shift_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM employee_shifts WHERE shift_id = %s AND (effective_to IS NULL OR effective_to >= CURRENT_DATE) LIMIT 1",
                (shift_id,),
            )
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Shift is currently assigned to employees")
            cur.execute("DELETE FROM shifts WHERE id = %s RETURNING id", (shift_id,))
            deleted = cur.fetchone()
            conn.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Shift not found")
    return {"message": "shift deleted"}


@router.post(
    "/employee-shifts",
    response_model=EmployeeShiftEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Assign shift to employee",
)
def assign_employee_shift(
    data: EmployeeShiftAssign,
    user=Depends(require_role(["admin", "hr"])),
):
    effective_from = parse_date_only(data.effective_from)
    effective_to = parse_date_only(data.effective_to) if data.effective_to else None
    if effective_to and effective_to < effective_from:
        raise HTTPException(status_code=400, detail="effective_to cannot be earlier than effective_from")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM employees WHERE id = %s AND is_active = TRUE", (data.employee_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Employee not found")
            cur.execute("SELECT 1 FROM shifts WHERE id = %s AND is_active = TRUE", (data.shift_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Shift not found")
            # Avvalgi ochiq biriktirishni yopib qo'yamiz (yangi assignment kelganda)
            cur.execute(
                """
                UPDATE employee_shifts
                SET effective_to = %s
                WHERE employee_id = %s
                  AND effective_to IS NULL
                """,
                (effective_from, data.employee_id),
            )
            cur.execute(
                """
                INSERT INTO employee_shifts (employee_id, shift_id, effective_from, effective_to)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (data.employee_id, data.shift_id, effective_from, effective_to),
            )
            new_id = cur.fetchone()[0]
            cur.execute(_select_employee_shift() + " WHERE es.id = %s", (new_id,))
            row = cur.fetchone()
            conn.commit()
    return {"message": "employee shift assigned", "data": _serialize_employee_shift(row)}


@router.get(
    "/employee-shifts",
    response_model=EmployeeShiftListResponse,
    summary="List employee shift assignments",
)
def list_employee_shifts(
    employee_id: Optional[str] = None,
    user=Depends(require_role(["admin", "hr"])),
):
    filters = []
    params: list = []
    if employee_id:
        filters.append("es.employee_id = %s")
        params.append(employee_id)
    where = f" WHERE {' AND '.join(filters)}" if filters else ""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                _select_employee_shift() + where + " ORDER BY es.effective_from DESC",
                params,
            )
            rows = cur.fetchall()
    return {"data": [_serialize_employee_shift(row) for row in rows]}
