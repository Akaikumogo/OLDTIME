from typing import Literal, Optional

from pydantic import BaseModel, Field

CategoryLiteral = Literal["productive", "unproductive", "neutral"]
PatternTypeLiteral = Literal["exact", "contains", "regex"]
ScopeLiteral = Literal["app", "site"]


class CategoryRuleCreate(BaseModel):
    pattern: str = Field(..., min_length=1, max_length=255)
    pattern_type: PatternTypeLiteral = "contains"
    category: CategoryLiteral
    department_id: Optional[str] = None
    label: Optional[str] = Field(None, max_length=100)
    priority: int = Field(100, ge=0, le=10000)
    is_active: bool = True


class CategoryRuleUpdate(BaseModel):
    pattern: Optional[str] = Field(None, min_length=1, max_length=255)
    pattern_type: Optional[PatternTypeLiteral] = None
    category: Optional[CategoryLiteral] = None
    department_id: Optional[str] = None
    label: Optional[str] = Field(None, max_length=100)
    priority: Optional[int] = Field(None, ge=0, le=10000)
    is_active: Optional[bool] = None


class CategoryRuleResponse(BaseModel):
    id: str
    pattern: str
    pattern_type: PatternTypeLiteral
    category: CategoryLiteral
    department_id: Optional[str] = None
    label: Optional[str] = None
    priority: int
    is_active: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CategoryRuleEnvelope(BaseModel):
    message: str
    data: CategoryRuleResponse


class CategoryRuleListResponse(BaseModel):
    data: list[CategoryRuleResponse]


class ProductivityBucket(BaseModel):
    name: str
    duration_seconds: int
    share: float


class ProductivityBreakdownResponse(BaseModel):
    productive_seconds: int
    unproductive_seconds: int
    neutral_seconds: int
    idle_seconds: int = 0
    active_seconds: int = 0
    total_seconds: int
    productivity_score: float
    by_app: list[ProductivityBucket]
    by_site: list[ProductivityBucket]
    by_label: list[ProductivityBucket]


class EmployeeProductivityRow(BaseModel):
    employee: dict
    productive_seconds: int
    unproductive_seconds: int
    neutral_seconds: int
    idle_seconds: int = 0
    active_seconds: int = 0
    total_seconds: int
    productivity_score: float


class EmployeeProductivityResponse(BaseModel):
    date_from: str
    date_to: str
    rows: list[EmployeeProductivityRow]


class DepartmentProductivityRow(BaseModel):
    department: dict
    employees: int
    productive_seconds: int
    unproductive_seconds: int
    neutral_seconds: int
    idle_seconds: int = 0
    active_seconds: int = 0
    total_seconds: int
    productivity_score: float


class DepartmentProductivityResponse(BaseModel):
    date_from: str
    date_to: str
    rows: list[DepartmentProductivityRow]


class AppConfigResponse(BaseModel):
    key: str
    value: Optional[str] = None
    description: Optional[str] = None
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None


class AppConfigListResponse(BaseModel):
    data: list[AppConfigResponse]


class AppConfigUpdate(BaseModel):
    value: str
    description: Optional[str] = None
