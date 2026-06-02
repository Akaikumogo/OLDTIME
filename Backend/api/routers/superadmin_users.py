"""
Superadmin User Management
Foydalanuvchi yaratish, o'chirish, role update
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from db import get_connection
from utils.auth import require_role
from utils.security import hash_password
import uuid

router = APIRouter(tags=["Superadmin Users"])


class AdminCreateRequest(BaseModel):
    """Admin yaratish uchun request"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    full_name: str = Field(..., min_length=1, max_length=255)
    role: str = Field(..., pattern="^(superadmin|admin|hr)$")
    is_active: bool = True


class AdminUpdateRequest(BaseModel):
    """Admin update uchun request"""
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    role: Optional[str] = Field(None, pattern="^(superadmin|admin|hr)$")
    is_active: Optional[bool] = None


@router.get("/superadmin/users", summary="List all system users")
def list_all_users(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    role_filter: Optional[str] = Query(None, pattern="^(superadmin|admin|hr)$"),
    user=Depends(require_role(["superadmin"])),
):
    """Barcha users'ni ko'rish (faqat superadmin)"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            if role_filter:
                cur.execute("SELECT COUNT(*) FROM admins WHERE role = %s", (role_filter,))
            else:
                cur.execute("SELECT COUNT(*) FROM admins")
            total = cur.fetchone()[0]

            offset = (page - 1) * limit
            if role_filter:
                cur.execute(
                    "SELECT id, username, email, full_name, role, is_active, created_at "
                    "FROM admins WHERE role = %s "
                    "ORDER BY created_at DESC LIMIT %s OFFSET %s",
                    (role_filter, limit, offset)
                )
            else:
                cur.execute(
                    "SELECT id, username, email, full_name, role, is_active, created_at "
                    "FROM admins ORDER BY created_at DESC LIMIT %s OFFSET %s",
                    (limit, offset)
                )

            users = [
                {
                    "id": str(row[0]),
                    "username": row[1],
                    "email": row[2],
                    "full_name": row[3],
                    "role": row[4],
                    "is_active": row[5],
                    "created_at": str(row[6]),
                }
                for row in cur.fetchall()
            ]

    return {
        "meta": {"total": total, "page": page, "limit": limit},
        "data": users,
    }


@router.post("/superadmin/users/create", status_code=status.HTTP_201_CREATED)
def create_user(
    data: AdminCreateRequest,
    user=Depends(require_role(["superadmin"])),
):
    """Yangi foydalanuvchi yaratish"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM admins WHERE username = %s", (data.username,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Username already exists")

            cur.execute("SELECT 1 FROM admins WHERE email = %s", (data.email,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Email already registered")

            user_id = str(uuid.uuid4())
            hashed_password = hash_password(data.password)

            cur.execute(
                "INSERT INTO admins (id, username, email, password_hash, "
                "full_name, role, is_active, created_by_user_id) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    user_id, data.username, data.email, hashed_password,
                    data.full_name, data.role, data.is_active, user.get("id"),
                ),
            )
            conn.commit()

    return {
        "message": "✅ User created successfully",
        "user_id": user_id,
        "username": data.username,
        "email": data.email,
        "role": data.role,
    }


@router.patch("/superadmin/users/{user_id}", summary="Update user details")
def update_user(
    user_id: str,
    data: AdminUpdateRequest,
    user=Depends(require_role(["superadmin"])),
):
    """User'ni update qilish"""
    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM admins WHERE id = %s", (user_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="User not found")

            set_clauses = []
            params = []
            for field, value in updates.items():
                set_clauses.append(f"{field} = %s")
                params.append(value)
            params.append(user_id)

            cur.execute(
                f"UPDATE admins SET {', '.join(set_clauses)}, updated_at = NOW() WHERE id = %s",
                params,
            )
            conn.commit()

    return {"message": "✅ User updated successfully", "user_id": user_id}


@router.delete("/superadmin/users/{user_id}", summary="Delete user")
def delete_user(
    user_id: str,
    user=Depends(require_role(["superadmin"])),
):
    """User'ni o'chirish"""
    if user_id == user.get("id"):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM admins WHERE id = %s RETURNING id", (user_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="User not found")
            conn.commit()

    return {"message": "✅ User deleted successfully"}


@router.post("/superadmin/users/{user_id}/change-role")
def change_user_role(
    user_id: str,
    new_role: str = Query(..., pattern="^(superadmin|admin|hr)$"),
    user=Depends(require_role(["superadmin"])),
):
    """User'ning role'sini o'zgartirish"""
    if user_id == user.get("id"):
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE admins SET role = %s, updated_at = NOW() WHERE id = %s",
                (new_role, user_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="User not found")
            conn.commit()

    return {
        "message": f"✅ User role changed to {new_role}",
        "user_id": user_id,
        "new_role": new_role,
    }


@router.post("/superadmin/users/{user_id}/toggle-active")
def toggle_user_active(
    user_id: str,
    user=Depends(require_role(["superadmin"])),
):
    """User'ni faollashtirish/deaktivlashtirish"""
    if user_id == user.get("id"):
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE admins SET is_active = NOT is_active, updated_at = NOW() "
                "WHERE id = %s RETURNING is_active",
                (user_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="User not found")
            new_status = row[0]
            conn.commit()

    return {
        "message": f"✅ User is now {'active' if new_status else 'inactive'}",
        "user_id": user_id,
        "is_active": new_status,
    }
