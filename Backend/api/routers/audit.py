"""Audit log endpointlari."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from services.audit_service import list_audit_for_event, list_audit_recent
from utils.auth import require_role

router = APIRouter(tags=["Audit"])


@router.get(
    "/audit/attendance-events/recent",
    summary="Recent attendance event audit logs",
)
def recent_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    action: Optional[str] = Query(None, description="created | updated | deleted"),
    user=Depends(require_role(["admin"])),
):
    if action and action not in ("created", "updated", "deleted"):
        raise HTTPException(status_code=400, detail="Invalid action")
    return {"data": list_audit_recent(limit=limit, action=action)}


@router.get(
    "/audit/attendance-events/{event_id}",
    summary="Audit logs for a specific event",
)
def audit_for_event(
    event_id: str,
    user=Depends(require_role(["admin"])),
):
    return {"data": list_audit_for_event(event_id)}
