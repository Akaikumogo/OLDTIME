"""Response/schema contract tests for enum-like values.

These tests catch bugs where business logic or SQL can produce a value that
Pydantic response models reject, which turns otherwise valid API data into a
500 response validation error.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import get_args, get_type_hints

from schemas.ai_camera import (
    CameraDetectionCreate,
    CameraResponse,
    CameraStatus,
    CameraTestResponse,
    DetectionType,
    ZoneResponse,
    ZoneType,
)
from schemas.attendance import (
    AttendanceDailyListResponse,
    AttendanceEventListResponse,
    AttendanceEventUpdate,
    AttendanceStatus as SchemaAttendanceStatus,
    DoorCreate,
    DoorEventType as SchemaDoorEventType,
    DoorUpdate,
    PermissionStatus,
    WorkPermissionCreate,
    WorkPermissionUpdate,
)
from schemas.holidays import HolidayResponse, HolidayTypeLiteral
from schemas.productivity import (
    CategoryLiteral,
    CategoryRuleCreate,
    CategoryRuleResponse,
    CategoryRuleUpdate,
    PatternTypeLiteral,
)
from services.attendance_status import (
    AttendanceStatus as ServiceAttendanceStatus,
    DoorEventType as ServiceDoorEventType,
)
from services.productivity_service import Category, CategoryRule


BACKEND_DIR = Path(__file__).resolve().parents[1]


def literal_values(annotation) -> set[str]:
    return set(get_args(annotation))


def enum_values(enum_cls) -> set[str]:
    return {item.value for item in enum_cls}


def validate_model(model_cls, **payload):
    if hasattr(model_cls, "model_validate"):
        return model_cls.model_validate(payload)
    return model_cls(**payload)


def sql_values(sql_file: str, column_name: str) -> set[str]:
    sql = (BACKEND_DIR / "sql" / sql_file).read_text(encoding="utf-8")
    pattern = rf"CHECK\s*\([^)]*?\b{re.escape(column_name)}\b\s+IN\s*\((.*?)\)\)"
    match = re.search(pattern, sql, flags=re.S)
    assert match, f"{column_name} CHECK not found in {sql_file}"
    return set(re.findall(r"'([^']+)'", match.group(1)))


def all_sql_value_sets(sql_file: str, column_name: str) -> list[set[str]]:
    sql = (BACKEND_DIR / "sql" / sql_file).read_text(encoding="utf-8")
    pattern = rf"CHECK\s*\([^)]*?\b{re.escape(column_name)}\b\s+IN\s*\((.*?)\)\)"
    matches = re.findall(pattern, sql, flags=re.S)
    assert matches, f"{column_name} CHECK not found in {sql_file}"
    return [set(re.findall(r"'([^']+)'", values)) for values in matches]


def attendance_event_payload(status: str) -> dict:
    return {
        "meta": {"page": 1, "limit": 20, "total": 1},
        "data": [
            {
                "id": "event-1",
                "card_id": "card-1",
                "serial_no": "serial-1",
                "event_timestamp": "2026-05-20T09:00:00",
                "status": status,
                "match_status": "matched",
                "picture_path": None,
                "created_at": "2026-05-20T09:00:01",
                "employee": {"id": "employee-1", "full_name": "Test Employee"},
                "door": {
                    "id": "door-1",
                    "name": "Main Entrance",
                    "ip_address": "192.168.0.10",
                    "event_type": "entry",
                },
            }
        ],
    }


def attendance_daily_payload(status: str) -> dict:
    return {
        "meta": {"page": 1, "limit": 20, "total": 1},
        "data": [
            {
                "id": "employee-1-2026-05-20",
                "date": "2026-05-20",
                "employee": {"id": "employee-1", "full_name": "Test Employee"},
                "statuses": [status],
                "markers": [
                    {
                        "type": "entry",
                        "label": "Entry",
                        "time": "09:00",
                        "full_time": "2026-05-20T09:00:00",
                        "status": status,
                        "color": "green",
                        "door_name": "Main Entrance",
                    }
                ],
                "segments": [],
            }
        ],
    }


def camera_response_payload(status: str = "unknown", zone_type: str = "UNKNOWN") -> dict:
    return {
        "id": "camera-1",
        "name": "Room Camera",
        "ip": "192.168.30.52",
        "username": "admin",
        "password_configured": True,
        "rtsp_main_url": "rtsp://redacted/main",
        "rtsp_sub_url": "rtsp://redacted/sub",
        "isapi_base_url": "http://192.168.30.52/ISAPI",
        "zone_id": "zone-1",
        "zone_name": "Work room",
        "zone_type": zone_type,
        "room_id": "room-1",
        "room_name": "Accounting",
        "has_audio": True,
        "has_speaker": True,
        "status": status,
        "last_checked_at": None,
        "last_error": None,
        "created_at": "2026-05-20T09:00:00",
        "updated_at": "2026-05-20T09:00:00",
        "stream_url": "/api/cameras/camera-1/stream",
        "audio_url": "/api/cameras/camera-1/audio",
    }


def test_attendance_service_statuses_match_response_schema():
    assert literal_values(ServiceAttendanceStatus) == literal_values(SchemaAttendanceStatus)


def test_attendance_response_models_accept_every_service_status():
    for status in literal_values(ServiceAttendanceStatus):
        validate_model(AttendanceEventUpdate, status=status)
        validate_model(AttendanceEventListResponse, **attendance_event_payload(status))
        validate_model(AttendanceDailyListResponse, **attendance_daily_payload(status))


def test_attendance_door_and_permission_sql_checks_match_schema_literals():
    door_values = literal_values(SchemaDoorEventType)
    assert literal_values(ServiceDoorEventType) == door_values
    assert sql_values("attendance_module.sql", "event_type") == door_values
    assert sql_values("attendance_module.sql", "door_event_type") == door_values
    for event_type in door_values:
        validate_model(DoorCreate, name="Front", ip_address="192.168.0.11", event_type=event_type)
        validate_model(DoorUpdate, event_type=event_type)

    permission_values = literal_values(PermissionStatus)
    assert sql_values("attendance_module.sql", "status") == permission_values
    for status in permission_values:
        validate_model(
            WorkPermissionCreate,
            employee_id="employee-1",
            permission_date="2026-05-20",
            start_time="10:00",
            end_time="11:00",
            reason="Task",
            status=status,
        )
        validate_model(WorkPermissionUpdate, status=status)


def test_productivity_service_schema_and_sql_category_contracts_match():
    rule_hints = get_type_hints(CategoryRule)
    assert literal_values(Category) == literal_values(CategoryLiteral)
    assert literal_values(rule_hints["pattern_type"]) == literal_values(PatternTypeLiteral)

    for values in all_sql_value_sets("productivity_module.sql", "category"):
        assert values == literal_values(CategoryLiteral)
    for values in all_sql_value_sets("productivity_module.sql", "pattern_type"):
        assert values == literal_values(PatternTypeLiteral)

    for category in literal_values(CategoryLiteral):
        validate_model(
            CategoryRuleCreate,
            pattern="vscode",
            pattern_type="contains",
            category=category,
        )
        validate_model(
            CategoryRuleResponse,
            id="rule-1",
            pattern="vscode",
            pattern_type="contains",
            category=category,
            priority=100,
            is_active=True,
        )
        validate_model(CategoryRuleUpdate, category=category)

    for pattern_type in literal_values(PatternTypeLiteral):
        validate_model(
            CategoryRuleCreate,
            pattern="vscode",
            pattern_type=pattern_type,
            category="productive",
        )
        validate_model(CategoryRuleUpdate, pattern_type=pattern_type)


def test_holiday_schema_and_sql_contract_match():
    values = literal_values(HolidayTypeLiteral)
    assert sql_values("productivity_module.sql", "holiday_type") == values
    for holiday_type in values:
        validate_model(
            HolidayResponse,
            id="holiday-1",
            date="2026-05-20",
            name="Holiday",
            type=holiday_type,
            is_paid=True,
        )


def test_ai_camera_schema_and_sql_enum_contracts_match():
    assert sql_values("ai_camera_tracking.sql", "type") == enum_values(ZoneType)
    assert sql_values("ai_camera_tracking.sql", "status") == enum_values(CameraStatus)
    assert sql_values("ai_camera_tracking.sql", "detection_type") == enum_values(DetectionType)


def test_ai_camera_response_models_accept_every_enum_value():
    for zone_type in enum_values(ZoneType):
        validate_model(
            ZoneResponse,
            id="zone-1",
            name="Zone",
            type=zone_type,
            productivity_weight=0.7,
            timeout_seconds=600,
            created_at="2026-05-20T09:00:00",
        )
        validate_model(CameraResponse, **camera_response_payload(zone_type=zone_type))

    for status in enum_values(CameraStatus):
        validate_model(CameraResponse, **camera_response_payload(status=status))
        validate_model(
            CameraTestResponse,
            camera_id="camera-1",
            status=status,
            message="ok",
            has_audio=True,
            has_speaker=True,
        )

    for detection_type in enum_values(DetectionType):
        validate_model(
            CameraDetectionCreate,
            camera_id="camera-1",
            track_id="track-1",
            detection_type=detection_type,
            confidence=0.85,
        )
