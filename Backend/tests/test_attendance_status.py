"""
Pure attendance_status funksiyalari uchun testlar.
DB'ga umuman tegmaymiz — barcha kirish ma'lumotlari mock.
"""
from datetime import datetime, time, date, timedelta

import pytest

from services.attendance_status import (
    DayEvent,
    ShiftPolicy,
    StatusContext,
    is_within_lunch,
    resolve_status,
    shift_window,
    weekday_key,
)


# -------------------- helpers --------------------

def make_shift(
    start="09:00",
    end="18:00",
    lunch_start="13:00",
    lunch_end="14:00",
    late_grace=5,
    early_grace=5,
    overnight=False,
    work_days=("mon", "tue", "wed", "thu", "fri"),
):
    return ShiftPolicy(
        work_start_time=time.fromisoformat(start),
        work_end_time=time.fromisoformat(end),
        lunch_start_time=time.fromisoformat(lunch_start) if lunch_start else None,
        lunch_end_time=time.fromisoformat(lunch_end) if lunch_end else None,
        late_grace_minutes=late_grace,
        early_leave_grace_minutes=early_grace,
        is_overnight=overnight,
        work_days=tuple(work_days),
    )


def at(dt_str: str) -> datetime:
    # 2026-05-04 dushanba (Monday)
    return datetime.fromisoformat(dt_str)


# -------------------- match_status edge cases --------------------

def test_unmatched_employee_short_circuits():
    ctx = StatusContext(
        door_event_type="entry",
        match_status="unmatched",
        event_dt=at("2026-05-04T09:01:00"),
        shift=make_shift(),
    )
    assert resolve_status(ctx) == "unmatched_employee"


def test_ambiguous_employee_short_circuits():
    ctx = StatusContext(
        door_event_type="exit",
        match_status="ambiguous",
        event_dt=at("2026-05-04T18:00:00"),
        shift=make_shift(),
    )
    assert resolve_status(ctx) == "ambiguous_employee"


def test_holiday_returns_holiday_status():
    ctx = StatusContext(
        door_event_type="entry",
        match_status="matched",
        event_dt=at("2026-05-04T09:01:00"),
        shift=make_shift(),
        is_holiday=True,
    )
    assert resolve_status(ctx) == "holiday"


def test_weekend_returns_weekend_status():
    # 2026-05-09 — shanba (Saturday); shift'ning work_days ichida yo'q
    ctx = StatusContext(
        door_event_type="entry",
        match_status="matched",
        event_dt=at("2026-05-09T09:01:00"),
        shift=make_shift(),
    )
    assert resolve_status(ctx) == "weekend"


def test_no_shift_falls_back_to_default():
    ctx = StatusContext(
        door_event_type="entry",
        match_status="matched",
        event_dt=at("2026-05-04T09:00:00"),
        shift=None,
    )
    assert resolve_status(ctx) == "entry"
    ctx2 = StatusContext(
        door_event_type="exit",
        match_status="matched",
        event_dt=at("2026-05-04T18:00:00"),
        shift=None,
    )
    assert resolve_status(ctx2) == "exit"


# -------------------- entry: on_time / late --------------------

def test_on_time_arrival_within_grace():
    ctx = StatusContext(
        door_event_type="entry",
        match_status="matched",
        event_dt=at("2026-05-04T09:04:00"),  # 5 daqiqa grace ichida
        shift=make_shift(late_grace=5),
    )
    assert resolve_status(ctx) == "on_time"


def test_on_time_arrival_at_exact_start():
    ctx = StatusContext(
        door_event_type="entry",
        match_status="matched",
        event_dt=at("2026-05-04T09:00:00"),
        shift=make_shift(),
    )
    assert resolve_status(ctx) == "on_time"


def test_late_arrival_after_grace():
    ctx = StatusContext(
        door_event_type="entry",
        match_status="matched",
        event_dt=at("2026-05-04T09:06:00"),  # 6 daqiqa, grace = 5
        shift=make_shift(late_grace=5),
    )
    assert resolve_status(ctx) == "late"


def test_zero_grace_strict_late_at_one_second_after():
    # Aniq sinov: grace 0 bo'lsa, 09:00:01 ham late
    ctx = StatusContext(
        door_event_type="entry",
        match_status="matched",
        event_dt=at("2026-05-04T09:00:01"),
        shift=make_shift(late_grace=0),
    )
    assert resolve_status(ctx) == "late"


# -------------------- entry: lunch_return va takroriy entry --------------------

def test_lunch_return_during_lunch():
    ctx = StatusContext(
        door_event_type="entry",
        match_status="matched",
        event_dt=at("2026-05-04T13:30:00"),
        shift=make_shift(),
    )
    assert resolve_status(ctx) == "lunch_return"


def test_subsequent_entry_returns_entry_not_late():
    # Birinchi entry allaqachon yozilgan; ikkinchisi 'entry'
    ctx = StatusContext(
        door_event_type="entry",
        match_status="matched",
        event_dt=at("2026-05-04T11:00:00"),  # Lunchdan tashqari
        shift=make_shift(),
        previous_events=[
            DayEvent(timestamp=at("2026-05-04T09:01:00"), door_event_type="entry"),
        ],
    )
    assert resolve_status(ctx) == "entry"


# -------------------- exit: on_time_exit / early_exit / lunch_out --------------------

def test_on_time_exit_after_workday_end():
    ctx = StatusContext(
        door_event_type="exit",
        match_status="matched",
        event_dt=at("2026-05-04T18:01:00"),
        shift=make_shift(),
    )
    assert resolve_status(ctx) == "on_time_exit"


def test_on_time_exit_within_early_grace():
    ctx = StatusContext(
        door_event_type="exit",
        match_status="matched",
        event_dt=at("2026-05-04T17:56:00"),  # 4 daqiqa erta, grace=5
        shift=make_shift(early_grace=5),
    )
    assert resolve_status(ctx) == "on_time_exit"


def test_early_exit_before_grace():
    ctx = StatusContext(
        door_event_type="exit",
        match_status="matched",
        event_dt=at("2026-05-04T17:30:00"),  # 30 daqiqa erta
        shift=make_shift(early_grace=5),
    )
    assert resolve_status(ctx) == "early_exit"


def test_lunch_out_during_lunch_window():
    ctx = StatusContext(
        door_event_type="exit",
        match_status="matched",
        event_dt=at("2026-05-04T13:00:00"),
        shift=make_shift(),
    )
    assert resolve_status(ctx) == "lunch_out"


# -------------------- overnight smena --------------------

def test_overnight_shift_late_after_midnight():
    # Smena 22:00 -> 06:00, xodim 22:30 da kirsa "on_time"
    overnight = make_shift(start="22:00", end="06:00", lunch_start=None, lunch_end=None,
                           late_grace=15, overnight=True,
                           work_days=("mon","tue","wed","thu","fri","sat","sun"))
    ctx = StatusContext(
        door_event_type="entry",
        match_status="matched",
        event_dt=at("2026-05-04T22:10:00"),
        shift=overnight,
    )
    assert resolve_status(ctx) == "on_time"


def test_overnight_shift_late_significant_delay():
    overnight = make_shift(start="22:00", end="06:00", lunch_start=None, lunch_end=None,
                           late_grace=10, overnight=True,
                           work_days=("mon","tue","wed","thu","fri","sat","sun"))
    ctx = StatusContext(
        door_event_type="entry",
        match_status="matched",
        event_dt=at("2026-05-04T23:00:00"),  # 1 soat kech
        shift=overnight,
    )
    assert resolve_status(ctx) == "late"


def test_overnight_shift_exit_after_morning_end():
    # Smena tunda 22:00 -> 06:00 (kelasi tongda tugaydi).
    # Xodim ertasi tongda 06:30 da chiqsa "on_time_exit"
    overnight = make_shift(start="22:00", end="06:00", lunch_start=None, lunch_end=None,
                           overnight=True, early_grace=10,
                           work_days=("mon","tue","wed","thu","fri","sat","sun"))
    ctx = StatusContext(
        door_event_type="exit",
        match_status="matched",
        event_dt=at("2026-05-05T06:30:00"),
        shift=overnight,
    )
    assert resolve_status(ctx) == "on_time_exit"


# -------------------- helper sinovlari --------------------

def test_shift_window_overnight_crosses_midnight():
    s = make_shift(start="22:00", end="06:00", overnight=True)
    start, end = shift_window(s, date(2026, 5, 4))
    assert start == datetime(2026, 5, 4, 22, 0)
    assert end == datetime(2026, 5, 5, 6, 0)


def test_is_within_lunch_basic():
    s = make_shift()
    assert is_within_lunch(s, at("2026-05-04T13:30:00")) is True
    assert is_within_lunch(s, at("2026-05-04T12:59:00")) is False
    assert is_within_lunch(s, at("2026-05-04T14:01:00")) is False


def test_weekday_key_returns_correct_label():
    # 2026-05-04 = Monday
    assert weekday_key(date(2026, 5, 4)) == "mon"
    # 2026-05-09 = Saturday
    assert weekday_key(date(2026, 5, 9)) == "sat"
    # 2026-05-10 = Sunday
    assert weekday_key(date(2026, 5, 10)) == "sun"


# -------------------- match_status edge cases (regression) --------------------

def test_unmatched_event_does_not_require_shift():
    """
    Bug fix: avval 'unmatched' eventlar saqlanmasdan tashlab yuborilardi.
    Hozir resolve_status shift=None bilan ham unmatched_employee qaytarishi kerak.
    """
    ctx = StatusContext(
        door_event_type="entry",
        match_status="unmatched",
        event_dt=at("2026-05-04T09:01:00"),
        shift=None,
    )
    assert resolve_status(ctx) == "unmatched_employee"


def test_ambiguous_event_does_not_require_shift():
    ctx = StatusContext(
        door_event_type="exit",
        match_status="ambiguous",
        event_dt=at("2026-05-04T18:00:00"),
        shift=None,
    )
    assert resolve_status(ctx) == "ambiguous_employee"
