"""Productivity hisoblash testlari (DB'siz)."""
import pytest

from services.productivity_service import (
    ActivitySegment,
    CategoryRule,
    calculate_breakdown,
    classify,
    short_domain,
    match_rule,
)


# -------------------- helpers --------------------

def app_rule(pattern, category, label=None, priority=100, dept=None, ptype="contains"):
    return CategoryRule(pattern=pattern, pattern_type=ptype, category=category,
                        label=label, priority=priority, department_id=dept)


def site_rule(pattern, category, label=None, priority=100, dept=None, ptype="contains"):
    return CategoryRule(pattern=pattern, pattern_type=ptype, category=category,
                        label=label, priority=priority, department_id=dept)


def seg(seconds, app=None, url=None):
    return ActivitySegment(duration_seconds=seconds, app_name=app, url=url)


# -------------------- short_domain --------------------

def test_short_domain_strips_protocol_and_www():
    assert short_domain("https://www.youtube.com/watch?v=abc") == "youtube.com"
    assert short_domain("http://github.com/user/repo") == "github.com"


def test_short_domain_handles_bare_host():
    assert short_domain("docs.google.com/spreadsheets") == "docs.google.com"


def test_short_domain_handles_none_and_empty():
    assert short_domain(None) is None
    assert short_domain("") is None


# -------------------- match_rule --------------------

def test_match_rule_exact_case_insensitive():
    rule = CategoryRule(pattern="VS Code", pattern_type="exact", category="productive")
    assert match_rule("vs code", rule) is True
    assert match_rule("vs codex", rule) is False


def test_match_rule_contains():
    rule = CategoryRule(pattern="vscode", pattern_type="contains", category="productive")
    assert match_rule("Visual Studio Code (vscode-1.85)", rule) is True
    assert match_rule("notepad", rule) is False


def test_match_rule_regex():
    rule = CategoryRule(pattern=r"^chrome\d*$", pattern_type="regex", category="neutral")
    assert match_rule("chrome", rule) is True
    assert match_rule("chrome120", rule) is True
    assert match_rule("googlechrome", rule) is False


def test_match_rule_invalid_regex_returns_false():
    rule = CategoryRule(pattern="[", pattern_type="regex", category="neutral")
    assert match_rule("anything", rule) is False


# -------------------- classify --------------------

def test_classify_site_takes_precedence_over_app_browser():
    app_rules = [app_rule("chrome", "neutral", priority=80)]
    site_rules = [site_rule("youtube.com", "unproductive", priority=10)]
    cat, label = classify("Google Chrome", "https://youtube.com/watch", app_rules, site_rules)
    assert cat == "unproductive"


def test_classify_falls_back_to_app_when_no_site_match():
    app_rules = [app_rule("vscode", "productive", "IDE")]
    cat, label = classify("VSCode", None, app_rules, [])
    assert cat == "productive"
    assert label == "IDE"


def test_classify_default_category_when_no_match():
    cat, label = classify("Unknown App", None, [], [], default_category="neutral")
    assert cat == "neutral"
    assert label is None


def test_classify_dept_rule_overrides_global():
    # Global qoida: telegram -> neutral
    # Department-specific qoida: telegram -> productive
    global_rules = [app_rule("telegram", "neutral", priority=50)]
    dept_rules = [app_rule("telegram", "productive", priority=10, dept="dept-1")]
    all_rules = global_rules + dept_rules
    cat, _ = classify("Telegram", None, all_rules, [], department_id="dept-1")
    assert cat == "productive"
    # Boshqa department uchun global qoida ishlaydi
    cat2, _ = classify("Telegram", None, all_rules, [], department_id="dept-2")
    assert cat2 == "neutral"


def test_classify_priority_lower_wins():
    rules = [
        app_rule("code", "neutral", priority=200),
        app_rule("vscode", "productive", priority=10),
    ]
    cat, _ = classify("VSCode", None, rules, [])
    assert cat == "productive"


# -------------------- calculate_breakdown --------------------

def test_breakdown_counts_categories():
    app_rules = [
        app_rule("vscode", "productive", "IDE"),
        app_rule("youtube", "unproductive", "Video"),
    ]
    site_rules = []
    segments = [
        seg(3600, app="VSCode"),         # productive
        seg(1800, app="YouTube"),        # unproductive
        seg(600, app="Finder"),          # default neutral
    ]
    bd = calculate_breakdown(segments, app_rules, site_rules)
    assert bd.productive_seconds == 3600
    assert bd.unproductive_seconds == 1800
    assert bd.neutral_seconds == 600
    assert bd.total_seconds == 6000


def test_breakdown_score_with_only_productive():
    app_rules = [app_rule("vscode", "productive")]
    bd = calculate_breakdown([seg(3600, app="VSCode")], app_rules, [])
    assert bd.productivity_score == 100.0


def test_breakdown_score_with_only_unproductive():
    app_rules = [app_rule("youtube", "unproductive")]
    bd = calculate_breakdown([seg(3600, app="YouTube")], app_rules, [])
    assert bd.productivity_score == 0.0


def test_breakdown_score_neutral_counts_half():
    bd = calculate_breakdown([seg(3600, app="Finder")], [], [], default_category="neutral")
    # Neutral 50% qiymat oladi
    assert bd.productivity_score == 50.0


def test_breakdown_empty_segments():
    bd = calculate_breakdown([], [], [])
    assert bd.total_seconds == 0
    assert bd.productivity_score == 0.0


def test_breakdown_zero_duration_skipped():
    bd = calculate_breakdown([seg(0, app="VSCode"), seg(60, app="VSCode")],
                             [app_rule("vscode", "productive")], [])
    assert bd.total_seconds == 60


def test_breakdown_aggregates_by_app_and_site_and_label():
    app_rules = [app_rule("vscode", "productive", "IDE")]
    site_rules = [site_rule("github.com", "productive", "Code")]
    segments = [
        seg(60, app="VSCode"),
        seg(120, app="VSCode", url="https://github.com/repo"),
        seg(30, app="Chrome", url="https://github.com/issue"),
    ]
    bd = calculate_breakdown(segments, app_rules, site_rules)
    assert bd.by_app.get("VSCode") == 180
    assert bd.by_site.get("github.com") == 150  # github.com bor URL bilan ikkita
    assert bd.by_label.get("Code") == 150  # Site label site_rules dan
