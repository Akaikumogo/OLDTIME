"""
DB backup va restore xizmati.

- export_database_to_json() — barcha jadval ma'lumotlarini JSON formatga eksport qiladi
- import_database_from_json(mode='replace') — DB ni butunlay almashtirish
- import_database_from_json(mode='merge') — mavjud ma'lumotlarga qo'shish, conflict'larni topish
- apply_merge_resolution() — conflict'larga yechim qo'llash (new_wins/old_wins/per-row)

Format:
{
    "version": "1",
    "exported_at": "2026-05-12T15:30:00",
    "tables": {
        "departments": [{"id": "...", "name": "...", ...}, ...],
        "employees":   [{"id": "...", ...}, ...],
        ...
    }
}
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

import psycopg2
import psycopg2.extras

from db import get_connection

logger = logging.getLogger(__name__)

# Eksport va import tartibi muhim: foreign key bog'lanishlar bo'lmagan jadvallar avval keladi
EXPORT_ORDER: tuple[str, ...] = (
    "admins",
    "departments",
    "positions",
    "doors",
    "attendance_policies",
    "shifts",
    "holidays",
    "app_categories",
    "site_categories",
    "app_config",
    "employees",
    "computers",
    "employee_device_mappings",
    "employee_shifts",
    "attendance_events",
    "attendance_event_audit_logs",
    "computer_activity_events",
    "work_permissions",
)

# Jadval primary key ustunlari (default: 'id')
PK_COLUMNS: dict[str, tuple[str, ...]] = {
    # Agar PK kombinatsiyalangan bo'lsa, shu yerda ko'rsatamiz
}


def _pk_for(table: str) -> tuple[str, ...]:
    return PK_COLUMNS.get(table, ("id",))


def _backup_dir() -> Path:
    path = os.getenv("BACKUP_DIR")
    if not path:
        path = str(Path(__file__).resolve().parents[1] / "backups")
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _serialize_value(value: Any) -> Any:
    if isinstance(value, (datetime,)):
        return value.isoformat()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, (bytes, bytearray)):
        return value.decode("utf-8", errors="replace")
    return value


def _serialize_row(row: dict) -> dict:
    return {k: _serialize_value(v) for k, v in row.items()}


def export_database_to_json() -> dict:
    """Barcha jadvallarni JSON formatga eksport qiladi."""
    tables: dict[str, list[dict]] = {}
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            for table in EXPORT_ORDER:
                try:
                    cur.execute(f"SELECT * FROM {table} ORDER BY 1")
                    rows = cur.fetchall()
                    tables[table] = [_serialize_row(dict(r)) for r in rows]
                except psycopg2.errors.UndefinedTable:
                    conn.rollback()
                    tables[table] = []
                except Exception as exc:
                    conn.rollback()
                    logger.warning("Table %s skipped: %s", table, exc)
                    tables[table] = []

    return {
        "version": "1",
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "tables": tables,
    }


def create_backup_file() -> Path:
    """JSON backup yaratadi va BACKUP_DIR ga saqlaydi. Yaratilgan fayl yo'lini qaytaradi."""
    payload = export_database_to_json()
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"workplus_backup_{ts}.json"
    path = _backup_dir() / filename
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def list_backup_files() -> list[dict]:
    """BACKUP_DIR dagi barcha backup fayllar ro'yxati."""
    directory = _backup_dir()
    files = []
    for item in directory.iterdir():
        if not item.is_file():
            continue
        if not (item.suffix in (".json", ".sql") or item.name.startswith("workplus_backup_")):
            continue
        stat = item.stat()
        files.append(
            {
                "name": item.name,
                "size_bytes": stat.st_size,
                "modified_at": stat.st_mtime,
            }
        )
    files.sort(key=lambda f: f["modified_at"], reverse=True)
    return files


def get_backup_path(filename: str) -> Path:
    """Fayl nomidan to'liq yo'lni qaytaradi. Path traversal'dan himoyalanadi."""
    safe_name = Path(filename).name  # path traversal himoya
    path = _backup_dir() / safe_name
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(filename)
    return path


def delete_backup(filename: str) -> bool:
    try:
        path = get_backup_path(filename)
        path.unlink()
        return True
    except FileNotFoundError:
        return False


def _validate_payload(payload: Any) -> dict[str, list[dict]]:
    if not isinstance(payload, dict):
        raise ValueError("Backup JSON ildizi obyekt bo'lishi kerak")
    tables = payload.get("tables")
    if not isinstance(tables, dict):
        raise ValueError("Backup JSON'da 'tables' obyekt bo'lishi kerak")
    return tables


def detect_conflicts(payload: Any) -> dict[str, list[dict]]:
    """
    Yangi ma'lumotlardagi PK lar DB'da mavjud bo'lganlarini topib qaytaradi.
    Result: { table_name: [ {pk, old_row, new_row}, ... ], ... }
    """
    tables = _validate_payload(payload)
    conflicts: dict[str, list[dict]] = {}

    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            for table in EXPORT_ORDER:
                new_rows = tables.get(table) or []
                if not new_rows:
                    continue
                pk_cols = _pk_for(table)
                pk_col = pk_cols[0]

                pk_values = [r.get(pk_col) for r in new_rows if r.get(pk_col) is not None]
                if not pk_values:
                    continue

                try:
                    cur.execute(
                        f"SELECT * FROM {table} WHERE {pk_col} = ANY(%s)",
                        (pk_values,),
                    )
                    existing = {str(r[pk_col]): _serialize_row(dict(r)) for r in cur.fetchall()}
                except psycopg2.errors.UndefinedTable:
                    conn.rollback()
                    continue
                except Exception as exc:
                    conn.rollback()
                    logger.warning("Conflict scan failed for %s: %s", table, exc)
                    continue

                table_conflicts = []
                for new_row in new_rows:
                    pk_val = new_row.get(pk_col)
                    if pk_val is None:
                        continue
                    key = str(pk_val)
                    if key in existing:
                        table_conflicts.append(
                            {
                                "pk": key,
                                "old_row": existing[key],
                                "new_row": new_row,
                            }
                        )
                if table_conflicts:
                    conflicts[table] = table_conflicts

    return conflicts


def _truncate_all(cur) -> None:
    """Barcha jadvallarni tozalaydi (RESTART IDENTITY CASCADE)."""
    # Ters tartibda: foreign key dependent lar avval o'chiriladi
    for table in reversed(EXPORT_ORDER):
        try:
            cur.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE")
        except psycopg2.errors.UndefinedTable:
            continue


def _insert_row(cur, table: str, row: dict) -> None:
    if not row:
        return
    cols = list(row.keys())
    placeholders = ", ".join(["%s"] * len(cols))
    col_list = ", ".join(cols)
    values = [row[c] for c in cols]
    cur.execute(
        f"INSERT INTO {table} ({col_list}) VALUES ({placeholders})",
        values,
    )


def _update_row(cur, table: str, row: dict, pk_col: str) -> None:
    cols = [c for c in row.keys() if c != pk_col]
    if not cols:
        return
    set_clause = ", ".join(f"{c} = %s" for c in cols)
    values = [row[c] for c in cols] + [row[pk_col]]
    cur.execute(
        f"UPDATE {table} SET {set_clause} WHERE {pk_col} = %s",
        values,
    )


def import_replace(payload: Any) -> dict:
    """Butunlay almashtirish: barcha jadvallar tozalanadi va backup'dan to'ldiriladi."""
    tables = _validate_payload(payload)

    inserted: dict[str, int] = {}
    with get_connection() as conn:
        with conn.cursor() as cur:
            _truncate_all(cur)
            for table in EXPORT_ORDER:
                rows = tables.get(table) or []
                count = 0
                for row in rows:
                    try:
                        _insert_row(cur, table, row)
                        count += 1
                    except psycopg2.errors.UndefinedTable:
                        break
                    except Exception as exc:
                        logger.warning(
                            "Insert failed for %s id=%s: %s",
                            table, row.get("id"), exc,
                        )
                        raise
                inserted[table] = count
        conn.commit()

    return {"mode": "replace", "inserted": inserted}


def import_merge(payload: Any, resolution: str = "new_wins", per_row: dict | None = None) -> dict:
    """
    Mavjud ma'lumotlarga qo'shish.

    resolution:
        - 'new_wins' — conflict bo'lsa, yangi versiya yoziladi
        - 'old_wins' — conflict bo'lsa, eski qoldiriladi
        - 'per_row'  — har bir conflict uchun alohida ('keep_old'/'use_new'/'skip')

    per_row format: { table_name: { pk: 'keep_old' | 'use_new' | 'skip' } }
    """
    if resolution not in ("new_wins", "old_wins", "per_row"):
        raise ValueError("resolution must be one of: new_wins, old_wins, per_row")
    per_row = per_row or {}

    tables = _validate_payload(payload)
    summary: dict[str, dict[str, int]] = {}

    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            for table in EXPORT_ORDER:
                new_rows = tables.get(table) or []
                if not new_rows:
                    continue
                pk_col = _pk_for(table)[0]

                pk_values = [r.get(pk_col) for r in new_rows if r.get(pk_col) is not None]
                if pk_values:
                    try:
                        cur.execute(
                            f"SELECT {pk_col} FROM {table} WHERE {pk_col} = ANY(%s)",
                            (pk_values,),
                        )
                        existing_pks = {str(r[pk_col]) for r in cur.fetchall()}
                    except psycopg2.errors.UndefinedTable:
                        conn.rollback()
                        continue
                else:
                    existing_pks = set()

                inserted = 0
                updated = 0
                skipped = 0

                for row in new_rows:
                    pk_val = row.get(pk_col)
                    key = str(pk_val) if pk_val is not None else None
                    is_conflict = key is not None and key in existing_pks

                    if not is_conflict:
                        try:
                            _insert_row(cur, table, row)
                            inserted += 1
                        except Exception as exc:
                            logger.warning(
                                "Insert failed for %s id=%s: %s",
                                table, pk_val, exc,
                            )
                            raise
                        continue

                    # Conflict — yechim
                    choice = resolution
                    if resolution == "per_row":
                        choice = (per_row.get(table) or {}).get(key, "keep_old")
                        if choice == "use_new":
                            choice = "new_wins"
                        elif choice == "skip":
                            skipped += 1
                            continue
                        else:
                            choice = "old_wins"

                    if choice == "new_wins":
                        _update_row(cur, table, row, pk_col)
                        updated += 1
                    else:
                        skipped += 1

                summary[table] = {
                    "inserted": inserted,
                    "updated": updated,
                    "skipped": skipped,
                }
        conn.commit()

    return {"mode": "merge", "resolution": resolution, "summary": summary}


# ---------- Logs ----------


def _log_dir() -> Path | None:
    path = os.getenv("LOG_DIR")
    if not path:
        return None
    p = Path(path)
    if not p.exists() or not p.is_dir():
        return None
    return p


def list_log_files() -> list[dict]:
    directory = _log_dir()
    if directory is None:
        return []
    files = []
    for item in directory.iterdir():
        if not item.is_file():
            continue
        stat = item.stat()
        files.append(
            {
                "name": item.name,
                "size_bytes": stat.st_size,
                "modified_at": stat.st_mtime,
            }
        )
    files.sort(key=lambda f: f["modified_at"], reverse=True)
    return files


def get_log_path(filename: str) -> Path:
    directory = _log_dir()
    if directory is None:
        raise FileNotFoundError("LOG_DIR not configured")
    safe_name = Path(filename).name
    path = directory / safe_name
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(filename)
    return path


def read_log_tail(filename: str, lines: int = 200) -> Iterable[str]:
    path = get_log_path(filename)
    with path.open("r", encoding="utf-8", errors="replace") as f:
        all_lines = f.readlines()
    return all_lines[-lines:]
