import os
from pathlib import Path

import psycopg2

from db import get_connection
from utils.security import hash_password

SQL_DIR = Path(__file__).resolve().parents[1] / "sql"
MIGRATION_DIR = Path(__file__).resolve().parents[1] / "migrations"

SQL_FILES = (
    "admins_module.sql",
    "employees_module.sql",
    "attendance_module.sql",
    "computer_monitoring.sql",
    "productivity_module.sql",
)

MIGRATION_FILES = (
    "001_add_optional_fields_to_employees.sql",
    "002_audit_log_set_null_on_delete.sql",
    "003_add_employee_code.sql",
    "004_add_employee_photo.sql",
)


def _read_default_superadmin() -> dict:
    """
    Default superadmin ma'lumotlari env'dan olinadi. Mavjud bo'lmasa,
    bootstrap o'tkazilmaydi va admin tizim orqali qo'lda yaratiladi.
    """
    return {
        "full_name": os.getenv("BOOTSTRAP_ADMIN_FULL_NAME", "").strip(),
        "username": os.getenv("BOOTSTRAP_ADMIN_USERNAME", "").strip(),
        "email": os.getenv("BOOTSTRAP_ADMIN_EMAIL", "").strip(),
        "password": os.getenv("BOOTSTRAP_ADMIN_PASSWORD", ""),
    }


def initialize_database():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # Apply initial schema
                for file_name in SQL_FILES:
                    sql_path = SQL_DIR / file_name
                    if sql_path.exists():
                        cur.execute(sql_path.read_text(encoding="utf-8"))

                # Apply migrations
                for file_name in MIGRATION_FILES:
                    migration_path = MIGRATION_DIR / file_name
                    if migration_path.exists():
                        cur.execute(migration_path.read_text(encoding="utf-8"))

                seed_default_superadmin(cur)

            conn.commit()
    except Exception as exc:
        # Startup should not hang because of DB/bootstrap issues.
        print(f"[WARN] Database initialization skipped: {exc}")


def seed_default_superadmin(cur):
    """
    Bootstrap admin yaratadi (faqat barcha qiymatlar env'da bor bo'lsa).
    Race condition oldini olish uchun admins jadvali LOCK qilinadi.
    """
    bootstrap = _read_default_superadmin()
    required = ("full_name", "username", "email", "password")
    if not all(bootstrap.get(field) for field in required):
        return

    if len(bootstrap["password"]) < 8:
        print("[WARN] BOOTSTRAP_ADMIN_PASSWORD shorter than 8 chars; skipping seed")
        return

    try:
        # Race condition oldini olish: jadvalni transaction davomida qulflaymiz
        cur.execute("LOCK TABLE admins IN SHARE ROW EXCLUSIVE MODE")
        cur.execute("SELECT COUNT(*) FROM admins")
        count = cur.fetchone()[0]
        if count > 0:
            return

        cur.execute(
            "SELECT 1 FROM admins WHERE username = %s OR email = %s",
            (bootstrap["username"], bootstrap["email"]),
        )
        if cur.fetchone():
            return

        hashed = hash_password(bootstrap["password"])
        cur.execute(
            "INSERT INTO admins (full_name, username, email, password_hash) VALUES (%s, %s, %s, %s)",
            (
                bootstrap["full_name"],
                bootstrap["username"],
                bootstrap["email"],
                hashed,
            ),
        )
        print(f"[INFO] Bootstrap admin seeded: {bootstrap['username']}")
    except psycopg2.errors.UndefinedTable:
        # Admins jadvali hali yaratilmagan
        return
    except Exception as exc:
        print(f"[WARN] Bootstrap admin seed skipped: {exc}")
