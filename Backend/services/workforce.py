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
    return {
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
    }


def ensure_department_exists(cur, department_id: str):
    cur.execute("SELECT 1 FROM departments WHERE id = %s", (department_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Department not found")


def ensure_position_exists(cur, position_id: str):
    cur.execute("SELECT 1 FROM positions WHERE id = %s", (position_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Position not found")
