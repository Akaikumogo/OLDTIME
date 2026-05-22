"""
Productivity hisoblash: dasturlar va saytlarni kategoriyaga ajratib,
vaqt taqsimotini chiqarib beradi.

Pure functionlar (test qilinadigan) + DB'ga boruvchi yordamchi funksiyalar.
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable, Literal, Optional
from urllib.parse import urlparse

Category = Literal["productive", "unproductive", "neutral"]


@dataclass(frozen=True)
class CategoryRule:
    pattern: str
    pattern_type: Literal["exact", "contains", "regex"]
    category: Category
    label: Optional[str] = None
    priority: int = 100
    department_id: Optional[str] = None


def normalize_text(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def short_domain(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        parsed = urlparse(url if "://" in url else f"http://{url}")
    except Exception:
        return None
    host = (parsed.netloc or parsed.path.split("/")[0] or "").lower()
    host = host.split("@", 1)[-1].split(":", 1)[0]
    if host.startswith("www."):
        host = host[4:]
    return host or None


def match_rule(text: str, rule: CategoryRule) -> bool:
    target = normalize_text(text)
    pattern = normalize_text(rule.pattern)
    if not target or not pattern:
        return False
    if rule.pattern_type == "exact":
        return target == pattern
    if rule.pattern_type == "contains":
        return pattern in target
    if rule.pattern_type == "regex":
        try:
            return bool(re.search(pattern, target))
        except re.error:
            return False
    return False


def classify(
    app_name: Optional[str],
    url: Optional[str],
    rules_app: Iterable[CategoryRule],
    rules_site: Iterable[CategoryRule],
    department_id: Optional[str] = None,
    default_category: Category = "neutral",
) -> tuple[Category, Optional[str]]:
    """
    Avval saytlarni tekshiradi (agar URL bor bo'lsa va u browser bo'lsa
    site sezgirroq) — chunki Chrome o'zi neutral, lekin ichida YouTube
    ochilgan bo'lsa "unproductive".
    Keyin app_name'ni tekshiradi.
    Agar departmentga maxsus qoida bo'lsa, undan oldin tekshiriladi.

    Returns: (category, label)
    """
    domain = short_domain(url)

    def filter_for_dept(rules: Iterable[CategoryRule]) -> tuple[list, list]:
        dept_rules: list[CategoryRule] = []
        global_rules: list[CategoryRule] = []
        for rule in rules:
            if rule.department_id and rule.department_id == department_id:
                dept_rules.append(rule)
            elif rule.department_id is None:
                global_rules.append(rule)
        dept_rules.sort(key=lambda r: r.priority)
        global_rules.sort(key=lambda r: r.priority)
        return dept_rules, global_rules

    site_dept, site_global = filter_for_dept(rules_site)
    app_dept, app_global = filter_for_dept(rules_app)

    if domain:
        for rule in site_dept + site_global:
            if match_rule(domain, rule) or match_rule(url or "", rule):
                return rule.category, rule.label

    if app_name:
        for rule in app_dept + app_global:
            if match_rule(app_name, rule):
                return rule.category, rule.label

    return default_category, None


@dataclass
class ActivitySegment:
    duration_seconds: int
    app_name: Optional[str]
    url: Optional[str]
    department_id: Optional[str] = None


@dataclass
class ProductivityBreakdown:
    productive_seconds: int = 0
    unproductive_seconds: int = 0
    neutral_seconds: int = 0
    idle_seconds: int = 0
    total_seconds: int = 0
    by_app: dict[str, int] = None  # type: ignore
    by_site: dict[str, int] = None  # type: ignore
    by_label: dict[str, int] = None  # type: ignore

    def __post_init__(self):
        if self.by_app is None:
            self.by_app = {}
        if self.by_site is None:
            self.by_site = {}
        if self.by_label is None:
            self.by_label = {}

    @property
    def active_seconds(self) -> int:
        return max(0, self.total_seconds - self.idle_seconds)

    @property
    def productivity_score(self) -> float:
        # 0.0 - 100.0 oraliqda. Idle vaqt score denominatoriga kirmaydi.
        # Neutral o'rtasiga sanaladi (0.5 koeffitsient).
        denom = self.active_seconds
        if denom == 0:
            return 0.0
        score = (self.productive_seconds + self.neutral_seconds * 0.5) / denom
        return round(score * 100.0, 2)


def calculate_breakdown(
    segments: Iterable[ActivitySegment],
    rules_app: Iterable[CategoryRule],
    rules_site: Iterable[CategoryRule],
    department_id: Optional[str] = None,
    default_category: Category = "neutral",
) -> ProductivityBreakdown:
    rules_app_list = list(rules_app)
    rules_site_list = list(rules_site)
    breakdown = ProductivityBreakdown()
    by_app: dict[str, int] = defaultdict(int)
    by_site: dict[str, int] = defaultdict(int)
    by_label: dict[str, int] = defaultdict(int)

    for seg in segments:
        seconds = max(int(seg.duration_seconds or 0), 0)
        if seconds == 0:
            continue
        if normalize_text(seg.app_name) in {"__idle__", "idle"}:
            breakdown.idle_seconds += seconds
            breakdown.total_seconds += seconds
            by_app["Idle"] += seconds
            by_label["Idle"] += seconds
            continue
        category, label = classify(
            seg.app_name,
            seg.url,
            rules_app_list,
            rules_site_list,
            department_id=seg.department_id or department_id,
            default_category=default_category,
        )
        breakdown.total_seconds += seconds
        if category == "productive":
            breakdown.productive_seconds += seconds
        elif category == "unproductive":
            breakdown.unproductive_seconds += seconds
        else:
            breakdown.neutral_seconds += seconds
        if seg.app_name:
            by_app[seg.app_name] += seconds
        site = short_domain(seg.url)
        if site:
            by_site[site] += seconds
        if label:
            by_label[label] += seconds

    breakdown.by_app = dict(by_app)
    breakdown.by_site = dict(by_site)
    breakdown.by_label = dict(by_label)
    return breakdown


# ----------------- DB layer -----------------

def fetch_rules(cur, scope: Literal["app", "site"]) -> list[CategoryRule]:
    table = "app_categories" if scope == "app" else "site_categories"
    cur.execute(
        f"""
        SELECT pattern, pattern_type, category, label, priority, department_id
        FROM {table}
        WHERE is_active = TRUE
        """
    )
    rows = cur.fetchall()
    rules: list[CategoryRule] = []
    for row in rows:
        rules.append(
            CategoryRule(
                pattern=row[0],
                pattern_type=row[1],
                category=row[2],
                label=row[3],
                priority=row[4] if row[4] is not None else 100,
                department_id=str(row[5]) if row[5] else None,
            )
        )
    return rules


def serialize_rule(row) -> dict:
    return {
        "id": str(row[0]),
        "pattern": row[1],
        "pattern_type": row[2],
        "category": row[3],
        "department_id": str(row[4]) if row[4] else None,
        "label": row[5],
        "priority": row[6],
        "is_active": bool(row[7]),
        "created_at": str(row[8]) if row[8] else None,
        "updated_at": str(row[9]) if row[9] else None,
    }
