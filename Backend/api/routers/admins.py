import hmac
import os

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from db import get_connection
from schemas.admin import (
    AdminCreate,
    AdminEnvelope,
    AdminListResponse,
    AdminUpdate,
)
from schemas.auth import LoginRequest, LoginResponse, RefreshRequest, RefreshResponse
from schemas.common import MessageResponse
from schemas.password_reset import PasswordResetRequest, PasswordResetResponse
from services.admins import ALLOWED_ADMIN_SORT_FIELDS, ALLOWED_SORT_ORDERS, serialize_admin
from utils.auth import require_role
from utils.security import (
    create_token,
    create_refresh_token,
    hash_password,
    optional_verify_token,
    verify_password,
    verify_refresh_token,
    verify_token,
)

router = APIRouter(tags=["Admins"])


@router.get(
    "/admins",
    response_model=AdminListResponse,
    summary="List admins",
    description="Return paginated admins list with optional role filter and safe sorting.",
)
def get_admins(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    role: str | None = Query(None, description="Filter by admin role"),
    sort: str = Query("id", description="Sort field"),
    order: str = Query("asc", description="Sort direction: asc or desc"),
    user=Depends(require_role(["admin"])),
):
    sort_column = ALLOWED_ADMIN_SORT_FIELDS.get(sort)
    sort_order = order.lower()

    if not sort_column:
        raise HTTPException(status_code=400, detail="Invalid sort field")

    if sort_order not in ALLOWED_SORT_ORDERS:
        raise HTTPException(status_code=400, detail="Invalid sort order")

    offset = (page - 1) * limit

    with get_connection() as conn:
        with conn.cursor() as cur:
            count_query = "SELECT COUNT(*) FROM admins"
            count_params = []

            if role:
                count_query += " WHERE role = %s"
                count_params.append(role)

            cur.execute(count_query, count_params)
            total_items = cur.fetchone()[0]
            total_pages = (total_items + limit - 1) // limit if total_items else 0

            query = """
                SELECT id, full_name, username, email, role, is_active, created_at
                FROM admins
            """
            params = []

            if role:
                query += " WHERE role = %s"
                params.append(role)

            query += f" ORDER BY {sort_column} {sort_order.upper()}"
            query += " LIMIT %s OFFSET %s"
            params.extend([limit, offset])

            cur.execute(query, params)
            rows = cur.fetchall()

    return {
        "meta": {
            "total_items": total_items,
            "total_pages": total_pages,
            "current_page": page,
            "limit": limit,
            "has_next": page < total_pages,
            "has_prev": page > 1 and total_pages > 0,
            "next_page": page + 1 if page < total_pages else None,
            "prev_page": page - 1 if page > 1 and total_pages > 0 else None,
        },
        "data": [serialize_admin(row) for row in rows],
    }


@router.post(
    "/admin/create",
    response_model=AdminEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create admin",
    description="Create bootstrap admin without token if no admins exist. Otherwise requires admin token.",
)
# def create_admin(data: AdminCreate, user=Depends(optional_verify_token)):
def create_admin(data: AdminCreate, user=Depends(optional_verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM admins")
            admin_count = cur.fetchone()[0]

            if admin_count > 0 and (not user or user.get("role") != "admin"):
                raise HTTPException(status_code=403, detail="Forbidden")

            cur.execute(
                "SELECT 1 FROM admins WHERE username = %s OR email = %s",
                (data.username, data.email),
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=409,
                    detail="Admin with this username or email already exists",
                )

            hashed = hash_password(data.password)
            cur.execute(
                """
                INSERT INTO admins (full_name, username, email, password_hash)
                VALUES (%s, %s, %s, %s)
                RETURNING id, full_name, username, email, role, is_active, created_at
                """,
                (data.full_name, data.username, data.email, hashed),
            )
            created_admin = cur.fetchone()
            conn.commit()

    return {"message": "admin created", "admin": serialize_admin(created_admin)}


@router.patch(
    "/admin/{admin_id}",
    response_model=AdminEnvelope,
    summary="Update admin",
    description="Update admin fields. Only admin role can access this endpoint.",
)
def update_admin(admin_id: str, data: AdminUpdate, user=Depends(require_role(["admin"]))):
    update_fields = []
    values = []

    if data.full_name is not None:
        update_fields.append("full_name = %s")
        values.append(data.full_name)
    if data.username is not None:
        update_fields.append("username = %s")
        values.append(data.username)
    if data.email is not None:
        update_fields.append("email = %s")
        values.append(data.email)
    if data.role is not None:
        update_fields.append("role = %s")
        values.append(data.role)
    if data.is_active is not None:
        update_fields.append("is_active = %s")
        values.append(data.is_active)

    if not update_fields:
        raise HTTPException(status_code=400, detail="Nothing to update")

    with get_connection() as conn:
        with conn.cursor() as cur:
            if data.username is not None or data.email is not None:
                cur.execute(
                    """
                    SELECT 1
                    FROM admins
                    WHERE (username = %s OR email = %s) AND id <> %s
                    """,
                    (data.username, data.email, admin_id),
                )
                if cur.fetchone():
                    raise HTTPException(
                        status_code=409,
                        detail="Admin with this username or email already exists",
                    )

            values.append(admin_id)
            cur.execute(
                f"""
                UPDATE admins
                SET {", ".join(update_fields)}
                WHERE id = %s
                RETURNING id, full_name, username, email, role, is_active, created_at
                """,
                values,
            )
            updated_admin = cur.fetchone()
            conn.commit()

    if not updated_admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    return {"message": "admin updated", "admin": serialize_admin(updated_admin)}


@router.delete(
    "/admin/{admin_id}",
    response_model=MessageResponse,
    summary="Delete admin",
    description="Hard-delete admin by id. Only admin role can access this endpoint.",
)
def delete_admin(admin_id: str, user=Depends(require_role(["admin"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM admins
                WHERE id = %s
                RETURNING id
                """,
                (admin_id,),
            )
            deleted = cur.fetchone()
            conn.commit()

    if not deleted:
        raise HTTPException(status_code=404, detail="Admin not found")

    return {"message": "admin deleted"}


@router.post(
    "/admin/login",
    response_model=LoginResponse,
    summary="Admin login",
    description="Authenticate admin and return bearer token with current user payload. Accepts both username and email.",
)
def login(data: LoginRequest):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, full_name, username, email, password_hash, role, is_active, created_at
                FROM admins
                WHERE username = %s OR email = %s
                """,
                (data.username, data.username),
            )
            admin = cur.fetchone()
    
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    admin_id, full_name, username, email, password_hash, role, is_active, created_at = admin

    if not is_active:
        raise HTTPException(status_code=403, detail="Admin is inactive")
    if not verify_password(data.password, password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token({"user_id": str(admin_id), "role": role})
    refresh_token = create_refresh_token({"user_id": str(admin_id), "role": role})
    return {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(admin_id),
            "full_name": full_name,
            "username": username,
            "email": email,
            "role": role,
            "is_active": is_active,
            "created_at": str(created_at),
        },
    }


@router.post(
    "/admin/refresh",
    response_model=RefreshResponse,
    summary="Refresh access token",
    description="Exchange refresh token for a new access token.",
)
def refresh_token(data: RefreshRequest):
    payload = verify_refresh_token(data.refresh_token)
    access_token = create_token({"user_id": payload["user_id"], "role": payload["role"]})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get(
    "/me",
    response_model=AdminEnvelope,
    summary="Get current user",
    description="Return authenticated admin profile from bearer token.",
)
def get_me(user=Depends(verify_token)):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, full_name, username, email, role, is_active, created_at
                FROM admins
                WHERE id = %s
                """,
                (user["user_id"],),
            )
            data = cur.fetchone()

    if not data:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "current user", "admin": serialize_admin(data)}


@router.post(
    "/public/reset-password",
    response_model=PasswordResetResponse,
    summary="Reset admin password",
    description="Public endpoint to reset admin password using access password.",
)
def reset_password(data: PasswordResetRequest):
    reset_key = os.getenv("RESET_PASSWORD_ACCESS_KEY")
    if not reset_key:
        raise HTTPException(status_code=503, detail="Password reset is not configured")
    if not hmac.compare_digest(data.accessPassword, reset_key):
        raise HTTPException(status_code=401, detail="Invalid access password")
    
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Find admin by email
            cur.execute(
                "SELECT id, username FROM admins WHERE email = %s",
                (data.email,),
            )
            admin = cur.fetchone()
            
            if not admin:
                raise HTTPException(status_code=404, detail="Admin with this email not found")
            
            admin_id, username = admin
            
            # Hash new password
            hashed_password = hash_password(data.password)
            
            # Update password
            cur.execute(
                "UPDATE admins SET password_hash = %s WHERE id = %s",
                (hashed_password, admin_id),
            )
            conn.commit()
    
    return {"message": f"Password reset successfully for admin {username}"}


@router.get(
    "/hikvision/status",
    summary="Get Hikvision poller status",
    description="Return real-time status of Hikvision polling engine, recent events, and device health.",
    tags=["System Status"],
)
def get_hikvision_status(request: Request, user=Depends(require_role(["admin"]))):
    """
    Returns:
    - running: Whether the polling thread is active
    - poll_interval_seconds: Polling frequency
    - active_doors: Number of active door devices
    - last_tick_at: Last poll timestamp
    - last_error: Last error message if any
    - stats: Processing statistics (total_events_processed, skipped, errors)
    - recent_events: Last 100 events (processed and skipped with reasons)
    """
    if not hasattr(request.app.state, 'hikvision_engine'):
        raise HTTPException(status_code=503, detail="Hikvision engine not initialized")
    
    engine = request.app.state.hikvision_engine
    return engine.status()


@router.get(
    "/hikvision/device-health/{ip_address}",
    summary="Get device health info",
    description="Return health status for specific device by IP address.",
    tags=["System Status"],
)
def get_device_health(ip_address: str, request: Request, user=Depends(require_role(["admin"]))):
    """
    Returns device health information including:
    - status: 'online', 'offline', or 'unknown'
    - last_checked_at: When device was last checked
    - last_success_at: When device last responded successfully
    - last_error: Last error message if connection failed
    """
    if not hasattr(request.app.state, 'hikvision_engine'):
        raise HTTPException(status_code=503, detail="Hikvision engine not initialized")
    
    engine = request.app.state.hikvision_engine
    return engine.get_device_health(ip_address)
