"""
System endpoints: backup, restore, log monitoring.
Faqat 'superadmin' / 'admin' rollarga ochiq.
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, JSONResponse

from schemas.common import MessageResponse
from services import backup_service
from utils.auth import require_role

router = APIRouter(prefix="/system", tags=["System"])

ADMIN_ROLES = ["superadmin", "admin"]


# ---------------- Backups ----------------


@router.get(
    "/backups",
    summary="List backup files",
    description="BACKUP_DIR dagi backup fayllar ro'yxati.",
)
def list_backups(user=Depends(require_role(ADMIN_ROLES))):
    return {"data": backup_service.list_backup_files()}


@router.post(
    "/backups",
    summary="Create new backup",
    description="DB ni JSON formatda eksport qilib, BACKUP_DIR ga saqlaydi.",
    status_code=status.HTTP_201_CREATED,
)
def create_backup(user=Depends(require_role(ADMIN_ROLES))):
    try:
        path = backup_service.create_backup_file()
        stat = path.stat()
        return {
            "message": "backup created",
            "data": {
                "name": path.name,
                "size_bytes": stat.st_size,
                "modified_at": stat.st_mtime,
            },
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Backup failed: {exc}") from exc


@router.get(
    "/backups/{filename}/download",
    summary="Download backup file",
)
def download_backup(filename: str, user=Depends(require_role(ADMIN_ROLES))):
    try:
        path = backup_service.get_backup_path(filename)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Backup file not found") from exc
    return FileResponse(
        path=str(path),
        filename=path.name,
        media_type="application/json",
    )


@router.delete(
    "/backups/{filename}",
    response_model=MessageResponse,
    summary="Delete backup file",
)
def delete_backup(filename: str, user=Depends(require_role(ADMIN_ROLES))):
    if not backup_service.delete_backup(filename):
        raise HTTPException(status_code=404, detail="Backup file not found")
    return {"message": "backup deleted"}


def _parse_uploaded_json(upload: UploadFile) -> Any:
    try:
        raw = upload.file.read()
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {exc}") from exc


@router.post(
    "/backups/upload/replace",
    summary="Upload backup and REPLACE entire database",
    description=(
        "JSON backup faylni qabul qiladi va butun bazani uning bilan almashtiradi. "
        "Barcha mavjud ma'lumotlar yo'q qilinadi va backup'dagi yozuvlar bilan to'ldiriladi."
    ),
)
async def upload_replace(
    file: UploadFile = File(...),
    user=Depends(require_role(ADMIN_ROLES)),
):
    payload = _parse_uploaded_json(file)
    try:
        result = backup_service.import_replace(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Restore failed: {exc}") from exc
    return {"message": "database replaced", "data": result}


@router.post(
    "/backups/upload/scan",
    summary="Upload backup and scan for conflicts (dry run)",
    description=(
        "JSON backup'ni ko'rib chiqib, DB'da mavjud PK lar bilan to'qnashuvlar ro'yxatini qaytaradi. "
        "Hech qanday o'zgartirish kiritmaydi."
    ),
)
async def upload_scan(
    file: UploadFile = File(...),
    user=Depends(require_role(ADMIN_ROLES)),
):
    payload = _parse_uploaded_json(file)
    try:
        conflicts = backup_service.detect_conflicts(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    summary = {table: len(rows) for table, rows in conflicts.items()}
    total = sum(summary.values())
    return {
        "data": {
            "total_conflicts": total,
            "by_table": summary,
            "conflicts": conflicts,
            # Frontend keyingi so'rovda shu payload'ni qaytaradi
            "payload": payload,
        }
    }


@router.post(
    "/backups/upload/merge",
    summary="Apply merge with conflict resolution",
    description=(
        "Scan'dan keyin chaqiriladi. Payload + resolution strategiyasi bilan import qilinadi.\n\n"
        "Body format:\n"
        "```json\n"
        "{\n"
        '  "payload": { "tables": {...} },\n'
        '  "resolution": "new_wins" | "old_wins" | "per_row",\n'
        '  "per_row": { "employees": { "<uuid>": "use_new" | "keep_old" | "skip" } }\n'
        "}\n```"
    ),
)
async def upload_merge(
    body: dict,
    user=Depends(require_role(ADMIN_ROLES)),
):
    payload = body.get("payload")
    resolution = body.get("resolution", "new_wins")
    per_row = body.get("per_row")

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="'payload' is required and must be an object")

    try:
        result = backup_service.import_merge(payload, resolution=resolution, per_row=per_row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Merge failed: {exc}") from exc

    return {"message": "merge applied", "data": result}


# ---------------- Logs ----------------


@router.get(
    "/logs",
    summary="List log files",
)
def list_logs(user=Depends(require_role(ADMIN_ROLES))):
    return {"data": backup_service.list_log_files()}


@router.get(
    "/logs/{filename}",
    summary="Read log file tail",
)
def read_log(
    filename: str,
    lines: int = Query(200, ge=10, le=5000),
    user=Depends(require_role(ADMIN_ROLES)),
):
    try:
        tail = backup_service.read_log_tail(filename, lines=lines)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"data": {"filename": filename, "lines": list(tail)}}


@router.get(
    "/logs/{filename}/download",
    summary="Download log file",
)
def download_log(filename: str, user=Depends(require_role(ADMIN_ROLES))):
    try:
        path = backup_service.get_log_path(filename)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(
        path=str(path),
        filename=path.name,
        media_type="text/plain",
    )
