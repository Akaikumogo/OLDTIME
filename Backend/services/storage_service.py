"""
Rasm va boshqa fayllarni saqlash servicesi.

Saqlash strategiyasi:
- Lokal filesystem: face_captures/ (Hikvision avtomatik), employee_photos/ (HR upload)
- Validatsiya: hajm cheklovi, magic byte (content-type bilan emas — soxta bo'lishi mumkin)
- Fayl nomi: UUID asosida (path traversal va collision'dan himoya)
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Optional, Tuple

from fastapi import HTTPException, UploadFile, status

from services.app_config import get_config_int, get_config_value


# Magic bytes — birinchi baytlar orqali fayl turini aniqlash.
# Content-Type header soxta bo'lishi mumkin, magic bytes ishonchliroq.
MAGIC_BYTES = {
    "jpg": [b"\xff\xd8\xff"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "webp": [b"RIFF", b"WEBP"],  # RIFF...WEBP
    "gif": [b"GIF87a", b"GIF89a"],
}

DEFAULT_MAX_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}


def _detect_image_type(head: bytes) -> Optional[str]:
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"RIFF") and b"WEBP" in head[:16]:
        return "webp"
    if head.startswith(b"GIF87a") or head.startswith(b"GIF89a"):
        return "gif"
    return None


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _safe_extension(detected: str) -> str:
    return "jpg" if detected == "jpeg" else detected


def get_employee_photo_dir() -> Path:
    base = get_config_value("EMPLOYEE_PHOTO_DIR", "employee_photos") or "employee_photos"
    path = Path(base)
    if not path.is_absolute():
        path = Path.cwd() / path
    _ensure_dir(path)
    return path


def get_face_captures_dir() -> Path:
    base = os.getenv("HIKVISION_PICTURES_DIR", "face_captures")
    path = Path(base)
    if not path.is_absolute():
        path = Path.cwd() / path
    _ensure_dir(path)
    return path


def get_max_upload_size() -> int:
    return get_config_int("UPLOAD_MAX_SIZE_BYTES", DEFAULT_MAX_SIZE)


async def save_image_upload(
    upload: UploadFile,
    target_dir: Path,
    filename_prefix: str = "",
) -> Tuple[str, Path]:
    """
    Rasmni xavfsiz tarzda saqlaydi.

    Returns:
        (relative_filename, absolute_path)
    Raises:
        HTTPException 400: noto'g'ri fayl turi yoki hajmi katta
    """
    max_size = get_max_upload_size()

    # Streaming bilan o'qish — katta fayl xotirani to'ldirmasligi uchun
    contents = await upload.read(max_size + 1)
    size = len(contents)
    if size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large (max {max_size} bytes)",
        )
    if size < 16:
        raise HTTPException(status_code=400, detail="File is empty or too small")

    detected = _detect_image_type(contents[:32])
    if not detected:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image type (allowed: jpg, png, webp, gif)",
        )

    ext = _safe_extension(detected)
    safe_name = f"{filename_prefix}{uuid.uuid4().hex}.{ext}"
    full_path = target_dir / safe_name

    # Path traversal himoyasi
    if not str(full_path.resolve()).startswith(str(target_dir.resolve())):
        raise HTTPException(status_code=400, detail="Invalid filename")

    full_path.write_bytes(contents)
    return safe_name, full_path


def delete_image_safely(directory: Path, filename: Optional[str]) -> bool:
    """Faylni xavfsiz o'chiradi (path traversal'dan himoya)."""
    if not filename:
        return False
    target = (directory / filename).resolve()
    if not str(target).startswith(str(directory.resolve())):
        return False
    if not target.exists():
        return False
    try:
        target.unlink()
        return True
    except Exception:
        return False


def employee_photo_url(filename: Optional[str]) -> Optional[str]:
    """Filename'dan public URL hosil qiladi."""
    if not filename:
        return None
    if filename.startswith(("http://", "https://", "/")):
        return filename
    return f"/static/employee_photos/{filename}"


def face_capture_url(stored_path: Optional[str]) -> Optional[str]:
    """Hikvision face capture path'idan public URL."""
    if not stored_path:
        return None
    if stored_path.startswith(("http://", "https://", "/")):
        return stored_path
    # stored_path face_captures/xxx.jpg ko'rinishida bo'lishi mumkin
    name = Path(stored_path).name
    return f"/static/face_captures/{name}"
