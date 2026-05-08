from fastapi import HTTPException

ALLOWED_SORT_ORDERS = {"asc", "desc"}
ALLOWED_EMPLOYEE_SORT_FIELDS = {
    "created_at": "e.created_at",
    "name": "e.full_name",
}


def serialize_department(row):
    return {
        "id": str(row[0]),
        "name": row[1],
        "created_at": str(row[2]),
    }


def serialize_position(row):
    return {
        "id": str(row[0]),
        "name": row[1],
        "created_at": str(row[2]),
    }


def serialize_employee(row):
    """
    Qabul qiluvchi tuple ko'rinishi (eski va yangi querylarda):
    (id, full_name, is_active, created_at, dept_id, dept_name, pos_id, pos_name
       [, employee_code [, photo_url]])
    """
    from services.storage_service import employee_photo_url

    base = {
        "id": str(row[0]),
        "full_name": row[1],
        "is_active": row[2],
        "created_at": str(row[3]),
        "department": {
            "id": str(row[4]),
            "name": row[5],
        },
        "position": {
            "id": str(row[6]),
            "name": row[7],
        },
        "employee_code": None,
        "photo_url": None,
    }
    if len(row) > 8 and row[8] is not None:
        base["employee_code"] = row[8]
    if len(row) > 9 and row[9] is not None:
        base["photo_url"] = employee_photo_url(row[9])
    return base


def ensure_department_exists(cur, department_id: str):
    cur.execute("SELECT 1 FROM departments WHERE id = %s", (department_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Department not found")


def ensure_position_exists(cur, position_id: str):
    cur.execute("SELECT 1 FROM positions WHERE id = %s", (position_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Position not found")
