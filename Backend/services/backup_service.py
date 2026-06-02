"""
Backup Management Service
Superadmin uchun: export/import, merge/hard-set
"""

import json
import gzip
import hashlib
import os
from datetime import datetime
from typing import Optional, Dict, Tuple
import logging

logger = logging.getLogger(__name__)

BACKUP_DIR = os.getenv("BACKUP_DIR", "./backups")
os.makedirs(BACKUP_DIR, exist_ok=True)


def _calculate_file_hash(file_path: str) -> str:
    """SHA256 hash'ini hisoblash"""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()


def export_backup(cur, backup_type: str = "FULL", backup_name: Optional[str] = None) -> Dict:
    """Serverdan backup export qilish"""
    if not backup_name:
        backup_name = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    backup_data = {}

    if backup_type in ["FULL", "EMPLOYEES"]:
        cur.execute("""
            SELECT id, full_name, email, phone, employee_code, department_id,
                   position_id, hire_date, is_active
            FROM employees ORDER BY created_at
        """)
        backup_data["employees"] = [
            {
                "id": str(row[0]), "full_name": row[1], "email": row[2],
                "phone": row[3], "employee_code": row[4],
                "department_id": str(row[5]) if row[5] else None,
                "position_id": str(row[6]) if row[6] else None,
                "hire_date": str(row[7]) if row[7] else None, "is_active": row[8],
            }
            for row in cur.fetchall()
        ]

        cur.execute("SELECT id, name, description FROM departments ORDER BY created_at")
        backup_data["departments"] = [
            {"id": str(row[0]), "name": row[1], "description": row[2]}
            for row in cur.fetchall()
        ]

        cur.execute("SELECT id, name, description FROM positions ORDER BY created_at")
        backup_data["positions"] = [
            {"id": str(row[0]), "name": row[1], "description": row[2]}
            for row in cur.fetchall()
        ]

    if backup_type in ["FULL", "ATTENDANCE"]:
        cur.execute("""
            SELECT id, employee_id, door_id, event_type, event_timestamp,
                   employee_name, card_id
            FROM attendance_events ORDER BY event_timestamp DESC LIMIT 100000
        """)
        backup_data["attendance_events"] = [
            {
                "id": str(row[0]), "employee_id": str(row[1]) if row[1] else None,
                "door_id": str(row[2]), "event_type": row[3],
                "event_timestamp": str(row[4]), "employee_name": row[5], "card_id": row[6],
            }
            for row in cur.fetchall()
        ]

    backup_data["metadata"] = {
        "backup_type": backup_type,
        "created_at": datetime.now().isoformat(),
        "total_records": sum(len(v) for k, v in backup_data.items() if k != "metadata"),
        "employees_count": len(backup_data.get("employees", [])),
        "attendance_events": len(backup_data.get("attendance_events", [])),
    }

    backup_path = os.path.join(BACKUP_DIR, f"{backup_name}.json.gz")
    with gzip.open(backup_path, "wt", encoding="utf-8") as f:
        json.dump(backup_data, f)

    file_size = os.path.getsize(backup_path)
    file_hash = _calculate_file_hash(backup_path)
    logger.info(f"✅ Backup exported: {backup_name}")

    return {
        "backup_name": backup_name,
        "backup_type": backup_type,
        "file_path": backup_path,
        "file_size": file_size,
        "file_hash": file_hash,
        "created_at": datetime.now().isoformat(),
        "records_count": backup_data["metadata"]["total_records"],
        "employees_count": backup_data["metadata"]["employees_count"],
        "attendance_events": backup_data["metadata"]["attendance_events"],
    }


def import_backup(cur, backup_file_path: str, restore_type: str = "MERGE") -> Dict:
    """Backup'ni serverga import qilish (MERGE yoki HARD_SET)"""
    if not os.path.exists(backup_file_path):
        raise FileNotFoundError(f"Backup file not found: {backup_file_path}")

    with gzip.open(backup_file_path, "rt", encoding="utf-8") as f:
        backup_data = json.load(f)

    stats = {"rows_merged": 0, "rows_deleted": 0, "rows_created": 0}

    if restore_type == "HARD_SET":
        logger.warning("🗑️  HARD_SET mode: deleting existing data")
        cur.execute("DELETE FROM attendance_events")
        cur.execute("DELETE FROM employees")
        cur.execute("DELETE FROM departments")
        cur.execute("DELETE FROM positions")

    if "departments" in backup_data:
        for dept in backup_data["departments"]:
            cur.execute("""
                INSERT INTO departments (id, name, description) VALUES (%s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, (dept["id"], dept["name"], dept.get("description")))
        stats["rows_created"] += len(backup_data["departments"])

    if "positions" in backup_data:
        for pos in backup_data["positions"]:
            cur.execute("""
                INSERT INTO positions (id, name, description) VALUES (%s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, (pos["id"], pos["name"], pos.get("description")))
        stats["rows_created"] += len(backup_data["positions"])

    if "employees" in backup_data:
        for emp in backup_data["employees"]:
            cur.execute("""
                INSERT INTO employees (id, full_name, email, phone, employee_code,
                    department_id, position_id, hire_date, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET full_name=EXCLUDED.full_name,
                    email=EXCLUDED.email, updated_at=NOW()
            """, (emp["id"], emp["full_name"], emp.get("email"), emp.get("phone"),
                  emp.get("employee_code"), emp.get("department_id"),
                  emp.get("position_id"), emp.get("hire_date"), emp.get("is_active", True)))
        stats["rows_created"] += len(backup_data["employees"])

    if "attendance_events" in backup_data:
        for att in backup_data["attendance_events"]:
            cur.execute("""
                INSERT INTO attendance_events (id, employee_id, door_id, event_type,
                    event_timestamp, employee_name, card_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
            """, (att["id"], att.get("employee_id"), att["door_id"],
                  att["event_type"], att["event_timestamp"],
                  att.get("employee_name"), att.get("card_id")))
        stats["rows_created"] += len(backup_data["attendance_events"])

    logger.info(f"✅ Backup imported ({restore_type}): {stats}")
    return stats


def list_backups(cur, limit: int = 50, offset: int = 0) -> Tuple[int, list]:
    """Backup'larning ro'yxatini olish"""
    cur.execute("SELECT COUNT(*) FROM backup_metadata")
    total = cur.fetchone()[0]

    cur.execute("""
        SELECT id, backup_name, backup_type, file_size, created_at,
               restored_at, restore_type, employees_count, attendance_events
        FROM backup_metadata ORDER BY created_at DESC LIMIT %s OFFSET %s
    """, (limit, offset))

    return total, [
        {"id": str(row[0]), "backup_name": row[1], "backup_type": row[2],
         "file_size": row[3], "created_at": str(row[4]),
         "restored_at": str(row[5]) if row[5] else None, "restore_type": row[6],
         "employees_count": row[7], "attendance_events": row[8]}
        for row in cur.fetchall()
    ]
