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
    "005_add_computer_device_id.sql",
)


DEFAULT_SUPERADMIN = {
    "full_name": "Sarvarbek Xazratov",
    "username": "superadmin",
    "email": "sarvarbekred147@gmail.com",
    "password": "sarvarbek.21",
    "role": "superadmin",
}


def _read_default_superadmin() -> dict:
    """
    Default superadmin ma'lumotlari env'dan olinadi. Env'da yo'q bo'lsa,
    yuqoridagi DEFAULT_SUPERADMIN qiymatlari ishlatiladi.
    """
    return {
        "full_name": os.getenv("BOOTSTRAP_ADMIN_FULL_NAME", "").strip() or DEFAULT_SUPERADMIN["full_name"],
        "username": os.getenv("BOOTSTRAP_ADMIN_USERNAME", "").strip() or DEFAULT_SUPERADMIN["username"],
        "email": os.getenv("BOOTSTRAP_ADMIN_EMAIL", "").strip() or DEFAULT_SUPERADMIN["email"],
        "password": os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "") or DEFAULT_SUPERADMIN["password"],
        "role": os.getenv("BOOTSTRAP_ADMIN_ROLE", "").strip() or DEFAULT_SUPERADMIN["role"],
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
    Har safar backend ishga tushganda default superadmin DB'da bormi
    tekshiradi. Yo'q bo'lsa — yaratadi. Bor bo'lsa — hech narsa qilmaydi
    (paroli o'zgartirilgan bo'lsa qayta tiklab qo'ymaydi).

    Race condition oldini olish uchun admins jadvali LOCK qilinadi.
    """
    bootstrap = _read_default_superadmin()
    required = ("full_name", "username", "email", "password")
    if not all(bootstrap.get(field) for field in required):
        return

    try:
        cur.execute(
            "SELECT 1 FROM admins WHERE email = %s OR username = %s",
            (bootstrap["email"], bootstrap["username"]),
        )
        if cur.fetchone():
            return

        hashed = hash_password(bootstrap["password"])
        try:
            cur.execute(
                "INSERT INTO admins (full_name, username, email, password_hash, role) VALUES (%s, %s, %s, %s, %s)",
                (
                    bootstrap["full_name"],
                    bootstrap["username"],
                    bootstrap["email"],
                    hashed,
                    bootstrap["role"],
                ),
            )
            print(
                f"[INFO] Default superadmin seeded: {bootstrap['email']} "
                f"(username: {bootstrap['username']})"
            )
        except psycopg2.errors.UniqueViolation:
            # Parallel startup ikkala server bir vaqtda yaratmoqchi bo'ldi
            return
    except psycopg2.errors.UndefinedTable:
        # Admins jadvali hali yaratilmagan
        return
    except Exception as exc:
        print(f"[WARN] Default superadmin seed skipped: {exc}")
