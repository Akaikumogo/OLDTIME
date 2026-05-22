"""Productivity, kategoriyalar va analitika uchun endpointlar."""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from db import get_connection
from schemas.common import MessageResponse
from schemas.productivity import (
    AppConfigListResponse,
    AppConfigResponse,
    AppConfigUpdate,
    CategoryRuleCreate,
    CategoryRuleEnvelope,
    CategoryRuleListResponse,
    CategoryRuleUpdate,
    DepartmentProductivityResponse,
    EmployeeProductivityResponse,
    ProductivityBreakdownResponse,
)
from services.app_config import (
    get_config_value,
    list_all_config,
    set_config_value,
)
from services.event_service import parse_filter_date
from services.productivity_service import (
    ActivitySegment,
    Category,
    calculate_breakdown,
    fetch_rules,
    serialize_rule,
)
from utils.auth import require_role

router = APIRouter(tags=["Productivity"])


def _table_for_scope(scope: str) -> str:
    if scope not in ("app", "site"):
        raise HTTPException(status_code=400, detail="Invalid scope")
    return "app_categories" if scope == "app" else "site_categories"


def _make_buckets(mapping: dict, total: int, top: int = 20) -> list[dict]:
    items = sorted(mapping.items(), key=lambda kv: kv[1], reverse=True)[:top]
    return [
        {
            "name": name,
            "duration_seconds": seconds,
            "share": round((seconds / total) * 100.0, 2) if total else 0.0,
        }
        for name, seconds in items
    ]


# -------------------- Category rules CRUD --------------------

@router.get("/categories/{scope}", response_model=CategoryRuleListResponse, summary="List category rules")
def list_category_rules(
    scope: str,
    department_id: Optional[str] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    user=Depends(require_role(["admin", "hr"])),
):
    table = _table_for_scope(scope)
    filters = []
    params: list = []
    if department_id:
        filters.append("department_id = %s")
        params.append(department_id)
    if category:
        filters.append("category = %s")
        params.append(category)
    if is_active is not None:
        filters.append("is_active = %s")
        params.append(is_active)
    where = f" WHERE {' AND '.join(filters)}" if filters else ""

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT id, pattern, pattern_type, category, department_id,
                       label, priority, is_active, created_at, updated_at
                FROM {table}
                {where}
                ORDER BY priority ASC, created_at DESC
                """,
                params,
            )
            rows = cur.fetchall()
    return {"data": [serialize_rule(row) for row in rows]}


@router.post(
    "/categories/{scope}",
    response_model=CategoryRuleEnvelope,
    status_code=status.HTTP_201_CREATED,
    summary="Create category rule",
)
def create_category_rule(
    scope: str,
    data: CategoryRuleCreate,
    user=Depends(require_role(["admin", "hr"])),
):
    table = _table_for_scope(scope)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                INSERT INTO {table} (
                    pattern, pattern_type, category,
                    department_id, label, priority, is_active
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, pattern, pattern_type, category, department_id,
                          label, priority, is_active, created_at, updated_at
                """,
                (
                    data.pattern,
                    data.pattern_type,
                    data.category,
                    data.department_id,
                    data.label,
                    data.priority,
                    data.is_active,
                ),
            )
            row = cur.fetchone()
            conn.commit()
    return {"message": "category rule created", "data": serialize_rule(row)}


@router.patch(
    "/categories/{scope}/{rule_id}",
    response_model=CategoryRuleEnvelope,
    summary="Update category rule",
)
def update_category_rule(
    scope: str,
    rule_id: str,
    data: CategoryRuleUpdate,
    user=Depends(require_role(["admin", "hr"])),
):
    table = _table_for_scope(scope)
    update_fields = []
    values: list = []
    field_map = {
        "pattern": "pattern",
        "pattern_type": "pattern_type",
        "category": "category",
        "department_id": "department_id",
        "label": "label",
        "priority": "priority",
        "is_active": "is_active",
    }
    provided = data.model_dump(exclude_unset=True)
    for key, column in field_map.items():
        if key in provided:
            update_fields.append(f"{column} = %s")
            values.append(provided[key])
    if not update_fields:
        raise HTTPException(status_code=400, detail="Nothing to update")
    values.append(rule_id)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE {table}
                SET {", ".join(update_fields)}, updated_at = NOW()
                WHERE id = %s
                RETURNING id, pattern, pattern_type, category, department_id,
                          label, priority, is_active, created_at, updated_at
                """,
                values,
            )
            row = cur.fetchone()
            conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Category rule not found")
    return {"message": "category rule updated", "data": serialize_rule(row)}


@router.delete("/categories/{scope}/{rule_id}", response_model=MessageResponse, summary="Delete category rule")
def delete_category_rule(
    scope: str,
    rule_id: str,
    user=Depends(require_role(["admin", "hr"])),
):
    table = _table_for_scope(scope)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {table} WHERE id = %s RETURNING id", (rule_id,))
            deleted = cur.fetchone()
            conn.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Category rule not found")
    return {"message": "category rule deleted"}


# -------------------- App config CRUD --------------------

@router.get("/app-config", response_model=AppConfigListResponse, summary="List app configuration")
def list_app_config(user=Depends(require_role(["admin"]))):
    return {"data": list_all_config()}


@router.put("/app-config/{key}", response_model=AppConfigResponse, summary="Update app configuration value")
def update_app_config(
    key: str,
    data: AppConfigUpdate,
    user=Depends(require_role(["admin"])),
):
    set_config_value(key, data.value, data.description, updated_by=user["user_id"])
    return AppConfigResponse(
        key=key,
        value=data.value,
        description=data.description,
    )


# -------------------- Productivity reports --------------------

def _fetch_segments(
    cur,
    start_dt,
    end_dt,
    employee_id: Optional[str] = None,
    department_id: Optional[str] = None,
):
    filters = ["cae.started_at <= %s", "cae.ended_at >= %s"]
    params: list = [end_dt, start_dt]
    if employee_id:
        filters.append("cae.employee_id = %s")
        params.append(employee_id)
    if department_id:
        filters.append(
            "EXISTS (SELECT 1 FROM employees emp WHERE emp.id = cae.employee_id AND emp.department_id = %s)"
        )
        params.append(department_id)
    where = " AND ".join(filters)
    cur.execute(
        f"""
        SELECT cae.app_name, cae.url, cae.duration_seconds,
               cae.employee_id, e.full_name, e.department_id, d.name,
               GREATEST(
                   0,
                   EXTRACT(EPOCH FROM (LEAST(cae.ended_at, %s) - GREATEST(cae.started_at, %s)))::int
               ) AS clipped_duration_seconds
        FROM computer_activity_events cae
        LEFT JOIN employees e ON e.id = cae.employee_id
        LEFT JOIN departments d ON d.id = e.department_id
        WHERE {where}
        ORDER BY cae.started_at ASC
        """,
        [end_dt, start_dt] + params,
    )
    return cur.fetchall()


@router.get(
    "/reports/productivity",
    response_model=ProductivityBreakdownResponse,
    summary="Productivity breakdown (single subject)",
    description="Bitta employee yoki butun company bo'yicha productivity hisoblaydi.",
)
def productivity_overview(
    date_from: str,
    date_to: str,
    employee_id: Optional[str] = None,
    department_id: Optional[str] = None,
    user=Depends(require_role(["admin", "hr"])),
):
    start_dt = parse_filter_date(date_from)
    end_dt = parse_filter_date(date_to, end_of_day=True)
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="date_from cannot be greater than date_to")

    default_category: Category = (get_config_value("PRODUCTIVITY_DEFAULT_CATEGORY", "neutral") or "neutral")  # type: ignore

    with get_connection() as conn:
        with conn.cursor() as cur:
            rules_app = fetch_rules(cur, "app")
            rules_site = fetch_rules(cur, "site")
            rows = _fetch_segments(cur, start_dt, end_dt, employee_id, department_id)

    segments = [
        ActivitySegment(
            duration_seconds=int(row[7] or row[2] or 0),
            app_name=row[0],
            url=row[1],
            department_id=str(row[5]) if row[5] else None,
        )
        for row in rows
    ]
    breakdown = calculate_breakdown(
        segments,
        rules_app,
        rules_site,
        department_id=department_id,
        default_category=default_category,
    )
    return ProductivityBreakdownResponse(
        productive_seconds=breakdown.productive_seconds,
        unproductive_seconds=breakdown.unproductive_seconds,
        neutral_seconds=breakdown.neutral_seconds,
        idle_seconds=breakdown.idle_seconds,
        active_seconds=breakdown.active_seconds,
        total_seconds=breakdown.total_seconds,
        productivity_score=breakdown.productivity_score,
        by_app=_make_buckets(breakdown.by_app, breakdown.total_seconds),
        by_site=_make_buckets(breakdown.by_site, breakdown.total_seconds),
        by_label=_make_buckets(breakdown.by_label, breakdown.total_seconds),
    )


@router.get(
    "/reports/productivity-by-employee",
    response_model=EmployeeProductivityResponse,
    summary="Productivity per employee",
)
def productivity_by_employee(
    date_from: str,
    date_to: str,
    department_id: Optional[str] = None,
    user=Depends(require_role(["admin", "hr"])),
):
    start_dt = parse_filter_date(date_from)
    end_dt = parse_filter_date(date_to, end_of_day=True)
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="date_from cannot be greater than date_to")
    default_category: Category = (get_config_value("PRODUCTIVITY_DEFAULT_CATEGORY", "neutral") or "neutral")  # type: ignore

    with get_connection() as conn:
        with conn.cursor() as cur:
            rules_app = fetch_rules(cur, "app")
            rules_site = fetch_rules(cur, "site")
            rows = _fetch_segments(cur, start_dt, end_dt, None, department_id)

    grouped: dict[str, dict] = {}
    for row in rows:
        emp_id = str(row[3]) if row[3] else "unknown"
        info = grouped.setdefault(
            emp_id,
            {
                "employee": {
                    "id": emp_id,
                    "full_name": row[4] or "Noma'lum",
                    "department": {"id": str(row[5]) if row[5] else None, "name": row[6]},
                },
                "segments": [],
                "department_id": str(row[5]) if row[5] else None,
            },
        )
        info["segments"].append(
            ActivitySegment(
                duration_seconds=int(row[7] or row[2] or 0),
                app_name=row[0],
                url=row[1],
                department_id=str(row[5]) if row[5] else None,
            )
        )

    output_rows = []
    for emp_id, info in grouped.items():
        breakdown = calculate_breakdown(
            info["segments"],
            rules_app,
            rules_site,
            department_id=info["department_id"],
            default_category=default_category,
        )
        output_rows.append(
            {
                "employee": info["employee"],
                "productive_seconds": breakdown.productive_seconds,
                "unproductive_seconds": breakdown.unproductive_seconds,
                "neutral_seconds": breakdown.neutral_seconds,
                "idle_seconds": breakdown.idle_seconds,
                "active_seconds": breakdown.active_seconds,
                "total_seconds": breakdown.total_seconds,
                "productivity_score": breakdown.productivity_score,
            }
        )
    output_rows.sort(key=lambda r: r["productivity_score"], reverse=True)
    return {
        "date_from": date_from,
        "date_to": date_to,
        "rows": output_rows,
    }


@router.get(
    "/reports/productivity-by-department",
    response_model=DepartmentProductivityResponse,
    summary="Productivity per department",
)
def productivity_by_department(
    date_from: str,
    date_to: str,
    user=Depends(require_role(["admin", "hr"])),
):
    start_dt = parse_filter_date(date_from)
    end_dt = parse_filter_date(date_to, end_of_day=True)
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="date_from cannot be greater than date_to")
    default_category: Category = (get_config_value("PRODUCTIVITY_DEFAULT_CATEGORY", "neutral") or "neutral")  # type: ignore

    with get_connection() as conn:
        with conn.cursor() as cur:
            rules_app = fetch_rules(cur, "app")
            rules_site = fetch_rules(cur, "site")
            rows = _fetch_segments(cur, start_dt, end_dt, None, None)

    grouped: dict[str, dict] = {}
    for row in rows:
        dept_id = str(row[5]) if row[5] else "unknown"
        info = grouped.setdefault(
            dept_id,
            {
                "department": {"id": dept_id, "name": row[6] or "Noma'lum"},
                "employee_ids": set(),
                "segments": [],
                "department_id": str(row[5]) if row[5] else None,
            },
        )
        if row[3]:
            info["employee_ids"].add(str(row[3]))
        info["segments"].append(
            ActivitySegment(
                duration_seconds=int(row[7] or row[2] or 0),
                app_name=row[0],
                url=row[1],
                department_id=str(row[5]) if row[5] else None,
            )
        )

    output_rows = []
    for dept_id, info in grouped.items():
        breakdown = calculate_breakdown(
            info["segments"],
            rules_app,
            rules_site,
            department_id=info["department_id"],
            default_category=default_category,
        )
        output_rows.append(
            {
                "department": info["department"],
                "employees": len(info["employee_ids"]),
                "productive_seconds": breakdown.productive_seconds,
                "unproductive_seconds": breakdown.unproductive_seconds,
                "neutral_seconds": breakdown.neutral_seconds,
                "idle_seconds": breakdown.idle_seconds,
                "active_seconds": breakdown.active_seconds,
                "total_seconds": breakdown.total_seconds,
                "productivity_score": breakdown.productivity_score,
            }
        )
    output_rows.sort(key=lambda r: r["productivity_score"], reverse=True)
    return {
        "date_from": date_from,
        "date_to": date_to,
        "rows": output_rows,
    }
