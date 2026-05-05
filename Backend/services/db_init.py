from pathlib import Path

from db import get_connection

SQL_DIR = Path(__file__).resolve().parents[1] / "sql"
MIGRATION_DIR = Path(__file__).resolve().parents[1] / "migrations"

SQL_FILES = (
    "employees_module.sql",
    "attendance_module.sql",
    "computer_monitoring.sql",
)

MIGRATION_FILES = (
    "001_add_optional_fields_to_employees.sql",
)


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

            conn.commit()
    except Exception as exc:
        # Startup should not hang because of DB/bootstrap issues.
        # Individual API requests will still fail fast via connection timeout.
        print(f"[WARN] Database initialization skipped: {exc}")
