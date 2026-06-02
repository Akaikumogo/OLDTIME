"""
Superadmin Backup Management API
"""
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, status
from typing import Optional
from db import get_connection
from utils.auth import require_role
from services.backup_service import (
    export_backup, import_backup, list_backups,
    save_backup_metadata, save_restore_log
)
import shutil
import os

router = APIRouter(tags=["Superadmin Backup"])


@router.get("/superadmin/backups", summary="List all backups")
def list_backups_endpoint(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(require_role(["superadmin"])),
):
    """Barcha backup'larni ko'rish (faqat superadmin)"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            total, data = list_backups(cur, limit, (page - 1) * limit)
    return {
        "meta": {"total": total, "page": page, "limit": limit},
        "data": data,
    }


@router.post("/superadmin/backups/export", status_code=status.HTTP_201_CREATED)
def export_backup_endpoint(
    backup_type: str = Query("FULL", pattern="^(FULL|EMPLOYEES|ATTENDANCE)$"),
    user=Depends(require_role(["superadmin"])),
):
    """
    Backup export qilish
    - FULL: barcha data
    - EMPLOYEES: faqat xodimlar/departmentlar
    - ATTENDANCE: faqat kelib-ketish
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            backup_info = export_backup(cur, backup_type=backup_type)
            backup_id = save_backup_metadata(cur, user.get("id"), backup_info)
            conn.commit()

    return {
        "message": "✅ Backup exported successfully",
        "backup_id": backup_id,
        "data": backup_info,
    }


@router.post("/superadmin/backups/download")
def download_backup_endpoint(
    backup_id: str,
    user=Depends(require_role(["superadmin"])),
):
    """Backup file'ni download qilish"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT file_path FROM backup_metadata WHERE id = %s",
                (backup_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Backup not found")
            file_path = row[0]

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Backup file not found")

    return {
        "message": "Backup ready for download",
        "file_path": file_path,
        "download_url": f"/api/superadmin/backups/files/{os.path.basename(file_path)}",
    }


@router.post("/superadmin/backups/import")
async def import_backup_endpoint(
    file: UploadFile = File(...),
    restore_type: str = Query("MERGE", pattern="^(MERGE|HARD_SET)$"),
    user=Depends(require_role(["superadmin"])),
):
    """
    Backup import qilish
    MERGE: mavjud data + backup data qo'shish
    HARD_SET: faqat backup data saqlash (qadimiy data o'chish)
    ⚠️  HARD_SET ehtiyot! Barcha qadimiy data o'chib ketadi
    """
    if restore_type == "HARD_SET":
        # Double confirmation
        confirmation = file.headers.get("X-Confirm-Hard-Set")
        if confirmation != "YES_DELETE_ALL_DATA":
            raise HTTPException(
                status_code=400,
                detail="HARD_SET requires X-Confirm-Hard-Set: YES_DELETE_ALL_DATA header",
            )

    # Temporary file'ga saqlash
    temp_path = f"/tmp/{file.filename}"
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        with get_connection() as conn:
            with conn.cursor() as cur:
                stats = import_backup(cur, temp_path, restore_type=restore_type)

                # Create backup metadata
                cur.execute("""
                    INSERT INTO backup_metadata (
                        superadmin_id, backup_name, backup_type,
                        file_size, restored_at, restore_type
                    ) VALUES (%s, %s, %s, %s, NOW(), %s)
                    RETURNING id
                """, (user.get("id"), file.filename, "IMPORTED", os.path.getsize(temp_path), restore_type))
                backup_id = cur.fetchone()[0]

                # Log restore
                save_restore_log(cur, str(backup_id), user.get("id"), restore_type, stats)
                conn.commit()

        return {
            "message": f"✅ Backup imported ({restore_type})",
            "restore_type": restore_type,
            "stats": stats,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.get("/superadmin/backups/{backup_id}/details")
def get_backup_details_endpoint(
    backup_id: str,
    user=Depends(require_role(["superadmin"])),
):
    """Backup'ning detallarini olish"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, backup_name, backup_type, file_size, file_hash,
                       created_at, restored_at, restore_type,
                       employees_count, attendance_events, total_records
                FROM backup_metadata WHERE id = %s
            """, (backup_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Backup not found")

            return {
                "id": str(row[0]),
                "backup_name": row[1],
                "backup_type": row[2],
                "file_size": row[3],
                "file_hash": row[4],
                "created_at": str(row[5]),
                "restored_at": str(row[6]) if row[6] else None,
                "restore_type": row[7],
                "employees_count": row[8],
                "attendance_events": row[9],
                "total_records": row[10],
            }
