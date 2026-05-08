"""Rasm va fayl yuklash endpointlari."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from db import get_connection
from services.audit_service import write_audit
from services.storage_service import (
    delete_image_safely,
    employee_photo_url,
    get_employee_photo_dir,
    get_face_captures_dir,
    save_image_upload,
)
from services.event_service import parse_datetime_input
from utils.auth import require_role

router = APIRouter(tags=["Uploads"])


@router.post(
    "/employees/{employee_id}/photo",
    summary="Upload employee profile photo",
    description=(
        "Xodim profil rasmini yuklaydi. JPG/PNG/WebP/GIF, max 5MB. "
        "Avvalgi rasm o'chiriladi va photo_url DB'da yangilanadi."
    ),
)
async def upload_employee_photo(
    employee_id: str,
    file: UploadFile = File(...),
    user=Depends(require_role(["admin", "hr"])),
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, full_name, photo_url FROM employees WHERE id = %s",
                (employee_id,),
            )
            employee = cur.fetchone()
            if not employee:
                raise HTTPException(status_code=404, detail="Employee not found")

            old_filename = employee[2]

            target_dir = get_employee_photo_dir()
            safe_name, _ = await save_image_upload(
                file,
                target_dir,
                filename_prefix=f"{employee_id[:8]}_",
            )

            cur.execute(
                "UPDATE employees SET photo_url = %s WHERE id = %s RETURNING id",
                (safe_name, employee_id),
            )
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(status_code=404, detail="Employee not found")
            conn.commit()

    # Eski rasmni o'chirish (xato bo'lsa ham new photo saqlanadi)
    if old_filename and not str(old_filename).startswith(("http://", "https://", "/")):
        delete_image_safely(get_employee_photo_dir(), old_filename)

    return {
        "message": "employee photo uploaded",
        "employee_id": employee_id,
        "filename": safe_name,
        "photo_url": employee_photo_url(safe_name),
    }


@router.delete(
    "/employees/{employee_id}/photo",
    summary="Delete employee profile photo",
)
async def delete_employee_photo(
    employee_id: str,
    user=Depends(require_role(["admin", "hr"])),
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT photo_url FROM employees WHERE id = %s",
                (employee_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Employee not found")
            old = row[0]
            cur.execute(
                "UPDATE employees SET photo_url = NULL WHERE id = %s",
                (employee_id,),
            )
            conn.commit()
    if old and not str(old).startswith(("http://", "https://", "/")):
        delete_image_safely(get_employee_photo_dir(), old)
    return {"message": "employee photo removed", "employee_id": employee_id}


@router.post(
    "/attendance-events/{event_id}/photo",
    summary="Upload event picture (manual)",
    description="Manual ravishda event'ga rasm biriktirish (masalan, Hikvision rasm yubormagan bo'lsa).",
)
async def upload_event_photo(
    event_id: str,
    file: UploadFile = File(...),
    user=Depends(require_role(["admin", "hr"])),
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, picture_path FROM attendance_events WHERE id = %s",
                (event_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Attendance event not found")
            old_path = row[1]

            target_dir = get_face_captures_dir()
            safe_name, full_path = await save_image_upload(
                file, target_dir, filename_prefix=f"manual_{event_id[:8]}_"
            )

            stored_path = str(full_path.relative_to(full_path.parent.parent)) if full_path.parent.parent != full_path.parent else f"{target_dir.name}/{safe_name}"
            stored_path = f"face_captures/{safe_name}"

            cur.execute(
                "UPDATE attendance_events SET picture_path = %s WHERE id = %s RETURNING id",
                (stored_path, event_id),
            )
            conn.commit()

    try:
        write_audit(
            event_id=event_id,
            action="updated",
            changed_by=user["user_id"],
            old_values={"picture_path": old_path},
            new_values={"picture_path": stored_path},
        )
    except Exception as exc:
        print(f"[WARN] Audit log write failed for event photo {event_id}: {exc}")

    return {
        "message": "event picture uploaded",
        "event_id": event_id,
        "picture_path": stored_path,
        "picture_url": f"/static/face_captures/{safe_name}",
    }
