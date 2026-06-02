"""
Unknown persons management API
Noma'lum shaxslarni employee'larga bog'lash uchun
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from schemas.common import MessageResponse
from db import get_connection
from utils.auth import require_role
from services.unknown_person_service import (
    find_or_create_unknown_person,
    link_unknown_to_employee,
    unlink_unknown_from_employee,
    list_unlinked_unknown_persons,
    get_unknown_person_details,
)

router = APIRouter(tags=["Unknown Persons Management"])


class UnknownPersonResponse:
    """Unknown person response model"""
    pass


@router.get(
    "/unknown-persons/unlinked",
    summary="List unlinked unknown persons"
)
def list_unlinked_unknown_persons_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user=Depends(require_role(["admin", "hr"])),
):
    """
    Hali employee'ga bog'lanmagan noma'lum shaxslar ro'yxati
    Har biri nechta marotaba ko'rilgani va qaysi joyda ko'rilgani ko'rsatiladi
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            total, data = list_unlinked_unknown_persons(cur, limit, offset)
    return {
        "meta": {"total": total, "limit": limit, "offset": offset},
        "data": data,
    }


@router.get(
    "/unknown-persons/{unknown_person_id}",
    summary="Get unknown person details"
)
def get_unknown_person_details_endpoint(
    unknown_person_id: str,
    user=Depends(require_role(["admin", "hr"])),
):
    """
    Unknown person'ning detallarini olish:
    - Nechta marotaba tanildi
    - Qaysi kamerada ko'rildi
    - Qaysi zonad ko'rildi
    - Snapshots
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            details = get_unknown_person_details(cur, unknown_person_id)
    return details


@router.post(
    "/unknown-persons/{unknown_person_id}/link-to-employee/{employee_id}",
    summary="Link unknown person to employee",
    status_code=status.HTTP_200_OK
)
def link_unknown_to_employee_endpoint(
    unknown_person_id: str,
    employee_id: str,
    reason: str | None = Query(None),
    user=Depends(require_role(["admin", "hr"])),
):
    """
    Unknown person'ni employee'ga bog'lash va
    qadimiy detections'ni retroaktiv qayta yuklash

    Ish:
    1. unknown_persons.linked_employee_id = employee_id qiladi
    2. Shu cluster'dagi barcha employee_id=NULL bo'lgan detections'ni
       ushbu employee'ga bog'laydi (tarihni qayta yuklash)
    3. Audit trail'ga qayd qiladi

    Natija: bu unknown person boshqa unknown bo'lmaydi,
            uning barcha tarixiy detections ishonchli bo'ladi
    """
    user_id = user.get("id") if user else None
    with get_connection() as conn:
        with conn.cursor() as cur:
            result = link_unknown_to_employee(
                cur,
                unknown_person_id,
                employee_id,
                user_id=user_id,
                reason=reason,
            )
            conn.commit()

    return {
        "message": f"Unknown person linked to employee {employee_id}",
        "data": result,
    }


@router.post(
    "/unknown-persons/{unknown_person_id}/unlink",
    summary="Unlink unknown person from employee",
    status_code=status.HTTP_200_OK
)
def unlink_unknown_from_employee_endpoint(
    unknown_person_id: str,
    reason: str | None = Query(None),
    user=Depends(require_role(["admin", "hr"])),
):
    """
    Unknown person'ni employee'dan ajratish (agar xato link qilingan bo'lsa)
    """
    user_id = user.get("id") if user else None
    with get_connection() as conn:
        with conn.cursor() as cur:
            result = unlink_unknown_from_employee(
                cur,
                unknown_person_id,
                user_id=user_id,
                reason=reason,
            )
            conn.commit()

    return {
        "message": "Unknown person unlinked",
        "data": result,
    }
