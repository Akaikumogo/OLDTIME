from pathlib import Path

from db import get_connection
from utils.security import hash_password

SQL_DIR = Path(__file__).resolve().parents[1] / "sql"
MIGRATION_DIR = Path(__file__).resolve().parents[1] / "migrations"

SQL_FILES = (
    "admins_module.sql",
    "employees_module.sql",
    "attendance_module.sql",
    "computer_monitoring.sql",
)

MIGRATION_FILES = (
    "001_add_optional_fields_to_employees.sql",
)

DEFAULT_SUPERADMIN = {
    "full_name": "Super Admin",
    "username": "superadmin",
    "email": "sarvarbekred147@gmail.com",
    "password": "sarvarbek.21",
}


def initialize_database():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # Apply initial schema
                for file_name in SQL_FILES:
                    sql_path = SQL_DIR / file_name
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
        # Individual API requests will still fail fast via connection timeout.
        print(f"[WARN] Database initialization skipped: {exc}")


def seed_default_superadmin(cur):
    try:
        cur.execute("SELECT COUNT(*) FROM admins")
        count = cur.fetchone()[0]
        if count > 0:
            return

        cur.execute(
            "SELECT 1 FROM admins WHERE username = %s OR email = %s",
            (DEFAULT_SUPERADMIN["username"], DEFAULT_SUPERADMIN["email"]),
        )
        if cur.fetchone():
            return

        hashed = hash_password(DEFAULT_SUPERADMIN["password"])
        cur.execute(
            "INSERT INTO admins (full_name, username, email, password_hash) VALUES (%s, %s, %s, %s)",
            (
                DEFAULT_SUPERADMIN["full_name"],
                DEFAULT_SUPERADMIN["username"],
                DEFAULT_SUPERADMIN["email"],
                hashed,
            ),
        )
        print("[INFO] Default superadmin seeded: superadmin / sarvarbek.21")
    except Exception as exc:
        print(f"[WARN] Default superadmin seed skipped: {exc}")
