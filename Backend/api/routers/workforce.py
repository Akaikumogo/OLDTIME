from fastapi import APIRouter, Depends, HTTPException, Query, status

from db import get_connection
from schemas.common import MessageResponse
from schemas.employees import (
    DepartmentCreate,
    DepartmentEnvelope,
    DepartmentListResponse,
    DepartmentResponse,
    DepartmentUpdate,
    EmployeeCreate,
    EmployeeEnvelope,
    EmployeeListResponse,
    EmployeeResponse,
    EmployeeUpdate,
    PositionCreate,
    PositionEnvelope,
    PositionListResponse,
    PositionResponse,
    PositionUpdate,
)
from services.workforce import (
    ALLOWED_EMPLOYEE_SORT_FIELDS,
    ALLOWED_SORT_ORDERS,
    ensure_department_exists,
    ensure_position_exists,
    serialize_department,
    serialize_employee,
    serialize_position,
)
from utils.auth import require_role

router = APIRouter(tags=["Workforce"])


@router.post(
    "/departments",
    response_model=DepartmentEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create department",
)
def create_department(
    data: DepartmentCreate,
    user=Depends(require_role(["admin", "hr"])),
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM departments WHERE name = %s", (data.name,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Department already exists")
            cur.execute(
                """
                INSERT INTO departments (name)
                VALUES (%s)
                RETURNING id, name, created_at
                """,
                (data.name,),
            )
            department = cur.fetchone()
            conn.commit()

    return {"message": "department created", "data": serialize_department(department)}


@router.get(
    "/departments",
    response_model=DepartmentListResponse,
    summary="List departments",
)
def list_departments(user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, created_at
                FROM departments
                ORDER BY created_at DESC
                """
            )
            rows = cur.fetchall()
    return {"data": [serialize_department(row) for row in rows]}


@router.get(
    "/departments/{department_id}",
    response_model=DepartmentResponse,
    summary="Get department",
)
def get_department(department_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, created_at
                FROM departments
                WHERE id = %s
                """,
                (department_id,),
            )
            department = cur.fetchone()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    return serialize_department(department)


@router.patch(
    "/departments/{department_id}",
    response_model=DepartmentEnvelope,
    summary="Update department",
)
def update_department(
    department_id: str,
    data: DepartmentUpdate,
    user=Depends(require_role(["admin", "hr"])),
):
    if data.name is None:
        raise HTTPException(status_code=400, detail="Nothing to update")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM departments WHERE name = %s AND id <> %s",
                (data.name, department_id),
            )
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Department already exists")
            cur.execute(
                """
                UPDATE departments
                SET name = %s
                WHERE id = %s
                RETURNING id, name, created_at
                """,
                (data.name, department_id),
            )
            department = cur.fetchone()
            conn.commit()

    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    return {"message": "department updated", "data": serialize_department(department)}


@router.delete(
    "/departments/{department_id}",
    response_model=MessageResponse,
    summary="Delete department",
)
def delete_department(department_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM employees WHERE department_id = %s LIMIT 1",
                (department_id,),
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=409,
                    detail="Department is linked to employees",
                )
            cur.execute(
                "DELETE FROM departments WHERE id = %s RETURNING id",
                (department_id,),
            )
            deleted = cur.fetchone()
            conn.commit()

    if not deleted:
        raise HTTPException(status_code=404, detail="Department not found")
    return {"message": "department deleted"}


@router.post(
    "/positions",
    response_model=PositionEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create position",
)
def create_position(
    data: PositionCreate,
    user=Depends(require_role(["admin", "hr"])),
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM positions WHERE name = %s", (data.name,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Position already exists")
            cur.execute(
                """
                INSERT INTO positions (name)
                VALUES (%s)
                RETURNING id, name, created_at
                """,
                (data.name,),
            )
            position = cur.fetchone()
            conn.commit()

    return {"message": "position created", "data": serialize_position(position)}


@router.get(
    "/positions",
    response_model=PositionListResponse,
    summary="List positions",
)
def list_positions(user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, created_at
                FROM positions
                ORDER BY created_at DESC
                """
            )
            rows = cur.fetchall()
    return {"data": [serialize_position(row) for row in rows]}


@router.get(
    "/positions/{position_id}",
    response_model=PositionResponse,
    summary="Get position",
)
def get_position(position_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, created_at
                FROM positions
                WHERE id = %s
                """,
                (position_id,),
            )
            position = cur.fetchone()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    return serialize_position(position)


@router.patch(
    "/positions/{position_id}",
    response_model=PositionEnvelope,
    summary="Update position",
)
def update_position(
    position_id: str,
    data: PositionUpdate,
    user=Depends(require_role(["admin", "hr"])),
):
    if data.name is None:
        raise HTTPException(status_code=400, detail="Nothing to update")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM positions WHERE name = %s AND id <> %s",
                (data.name, position_id),
            )
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Position already exists")
            cur.execute(
                """
                UPDATE positions
                SET name = %s
                WHERE id = %s
                RETURNING id, name, created_at
                """,
                (data.name, position_id),
            )
            position = cur.fetchone()
            conn.commit()

    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    return {"message": "position updated", "data": serialize_position(position)}


@router.delete(
    "/positions/{position_id}",
    response_model=MessageResponse,
    summary="Delete position",
)
def delete_position(position_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM employees WHERE position_id = %s LIMIT 1",
                (position_id,),
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=409,
                    detail="Position is linked to employees",
                )
            cur.execute(
                "DELETE FROM positions WHERE id = %s RETURNING id",
                (position_id,),
            )
            deleted = cur.fetchone()
            conn.commit()

    if not deleted:
        raise HTTPException(status_code=404, detail="Position not found")
    return {"message": "position deleted"}


@router.post(
    "/employees",
    response_model=EmployeeEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create employee",
    description="Create employee linked to existing department and position.",
)
def create_employee(
    data: EmployeeCreate,
    user=Depends(require_role(["admin", "hr"])),
):
    with get_connection() as conn:
        with conn.cursor() as cur:
            ensure_department_exists(cur, data.department_id)
            ensure_position_exists(cur, data.position_id)
            cur.execute(
                """
                INSERT INTO employees (full_name, department_id, position_id, is_active)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (
                    data.full_name,
                    data.department_id,
                    data.position_id,
                    data.is_active,
                ),
            )
            employee_id = cur.fetchone()[0]
            cur.execute(
                """
                SELECT
                    e.id,
                    e.full_name,
                    e.is_active,
                    e.created_at,
                    d.id,
                    d.name,
                    p.id,
                    p.name
                FROM employees e
                JOIN departments d ON d.id = e.department_id
                JOIN positions p ON p.id = e.position_id
                WHERE e.id = %s
                """,
                (employee_id,),
            )
            created_employee = cur.fetchone()
            conn.commit()
    return {"message": "employee created", "data": serialize_employee(created_employee)}


@router.get(
    "/employees",
    response_model=EmployeeListResponse,
    summary="List employees",
    description="Paginated employees list with department and active filters.",
)
def list_employees(
    page: int = Query(..., ge=1, description="Page number"),
    limit: int = Query(..., ge=1, le=100, description="Items per page"),
    department_id: str | None = Query(None, description="Filter by department UUID"),
    is_active: bool | None = Query(None, description="Filter by activity status"),
    sort: str = Query("created_at", description="created_at or name"),
    order: str = Query("desc", description="asc or desc"),
    user=Depends(require_role(["admin", "hr"])),
):
    sort_column = ALLOWED_EMPLOYEE_SORT_FIELDS.get(sort)
    sort_order = order.lower()

    if not sort_column:
        raise HTTPException(status_code=400, detail="Invalid sort field")
    if sort_order not in ALLOWED_SORT_ORDERS:
        raise HTTPException(status_code=400, detail="Invalid sort order")

    filters = []
    params = []

    if department_id is not None:
        filters.append("e.department_id = %s")
        params.append(department_id)
    if is_active is not None:
        filters.append("e.is_active = %s")
        params.append(is_active)

    where_clause = f" WHERE {' AND '.join(filters)}" if filters else ""
    offset = (page - 1) * limit

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM employees e{where_clause}", params)
            total = cur.fetchone()[0]

            list_params = params + [limit, offset]
            cur.execute(
                f"""
                SELECT
                    e.id,
                    e.full_name,
                    e.is_active,
                    e.created_at,
                    d.id,
                    d.name,
                    p.id,
                    p.name
                FROM employees e
                JOIN departments d ON d.id = e.department_id
                JOIN positions p ON p.id = e.position_id
                {where_clause}
                ORDER BY {sort_column} {sort_order.upper()}
                LIMIT %s OFFSET %s
                """,
                list_params,
            )
            rows = cur.fetchall()

    return {
        "meta": {"page": page, "limit": limit, "total": total},
        "data": [serialize_employee(row) for row in rows],
    }


@router.get(
    "/employees/{employee_id}",
    response_model=EmployeeResponse,
    summary="Get employee",
)
def get_employee(employee_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    e.id,
                    e.full_name,
                    e.is_active,
                    e.created_at,
                    d.id,
                    d.name,
                    p.id,
                    p.name
                FROM employees e
                JOIN departments d ON d.id = e.department_id
                JOIN positions p ON p.id = e.position_id
                WHERE e.id = %s
                """,
                (employee_id,),
            )
            employee = cur.fetchone()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return serialize_employee(employee)


@router.patch(
    "/employees/{employee_id}",
    response_model=EmployeeEnvelope,
    summary="Update employee",
)
def update_employee(
    employee_id: str,
    data: EmployeeUpdate,
    user=Depends(require_role(["admin", "hr"])),
):
    update_fields = []
    values = []

    with get_connection() as conn:
        with conn.cursor() as cur:
            if data.department_id is not None:
                ensure_department_exists(cur, data.department_id)
                update_fields.append("department_id = %s")
                values.append(data.department_id)
            if data.position_id is not None:
                ensure_position_exists(cur, data.position_id)
                update_fields.append("position_id = %s")
                values.append(data.position_id)
            if data.full_name is not None:
                update_fields.append("full_name = %s")
                values.append(data.full_name)
            if data.is_active is not None:
                update_fields.append("is_active = %s")
                values.append(data.is_active)

            if not update_fields:
                raise HTTPException(status_code=400, detail="Nothing to update")

            values.append(employee_id)
            cur.execute(
                f"""
                UPDATE employees
                SET {", ".join(update_fields)}
                WHERE id = %s
                RETURNING id
                """,
                values,
            )
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(status_code=404, detail="Employee not found")

            cur.execute(
                """
                SELECT
                    e.id,
                    e.full_name,
                    e.is_active,
                    e.created_at,
                    d.id,
                    d.name,
                    p.id,
                    p.name
                FROM employees e
                JOIN departments d ON d.id = e.department_id
                JOIN positions p ON p.id = e.position_id
                WHERE e.id = %s
                """,
                (employee_id,),
            )
            employee = cur.fetchone()
            conn.commit()

    return {"message": "employee updated", "data": serialize_employee(employee)}


@router.delete(
    "/employees/{employee_id}",
    response_model=MessageResponse,
    summary="Deactivate employee",
    description="Soft-delete employee by setting is_active to false.",
)
def delete_employee(employee_id: str, user=Depends(require_role(["admin", "hr"]))):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE employees
                SET is_active = FALSE
                WHERE id = %s
                RETURNING id
                """,
                (employee_id,),
            )
            updated = cur.fetchone()
            conn.commit()

    if not updated:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "employee deactivated"}
