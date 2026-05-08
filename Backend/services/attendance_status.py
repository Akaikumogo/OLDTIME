"""
Pure functions for attendance status calculation.

Hech qanday DB'ga ulanmaydi, hech qanday I/O qilmaydi — shuning uchun bemalol
unit testlar yozish mumkin. Test'lar uchun mock data: shift, holiday, day_events.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Iterable, Literal, Optional

DoorEventType = Literal["entry", "exit"]
MatchStatus = Literal["matched", "unmatched", "ambiguous"]
AttendanceStatus = Literal[
    "on_time", "late", "entry", "exit",
    "lunch_out", "lunch_return",
    "early_exit", "on_time_exit",
    "unmatched_employee", "ambiguous_employee",
    "holiday", "weekend",
]


@dataclass(frozen=True)
class ShiftPolicy:
    """Smena qoidasi. Policy yoki Shift jadvalidan kelishi mumkin."""
    work_start_time: time
    work_end_time: time
    lunch_start_time: Optional[time] = None
    lunch_end_time: Optional[time] = None
    late_grace_minutes: int = 0
    early_leave_grace_minutes: int = 0
    is_overnight: bool = False
    work_days: tuple[str, ...] = ("mon", "tue", "wed", "thu", "fri")

    @property
    def crosses_midnight(self) -> bool:
        return self.is_overnight or self.work_end_time < self.work_start_time


@dataclass(frozen=True)
class DayEvent:
    """Bir kunlik attendance event'i (status hisoblashga kirish)."""
    timestamp: datetime
    door_event_type: DoorEventType


@dataclass
class StatusContext:
    """Joriy event uchun statusni aniqlash konteksti."""
    door_event_type: DoorEventType
    match_status: MatchStatus
    event_dt: datetime
    shift: Optional[ShiftPolicy]
    is_holiday: bool = False
    previous_events: list[DayEvent] = field(default_factory=list)


WEEKDAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def weekday_key(value: date) -> str:
    return WEEKDAY_KEYS[value.weekday()]


def is_weekend(day: date, weekend_days: Iterable[str] = ("sat", "sun")) -> bool:
    return weekday_key(day) in set(weekend_days)


def shift_window(shift: ShiftPolicy, day: date) -> tuple[datetime, datetime]:
    """
    Shift uchun ishga kelish va ketish chegaralarini qaytaradi.
    Tunda smenada end_time keyingi kunga o'tadi.
    """
    start = datetime.combine(day, shift.work_start_time)
    end = datetime.combine(day, shift.work_end_time)
    if shift.crosses_midnight:
        end = end + timedelta(days=1)
    return start, end


def lunch_window(shift: ShiftPolicy, day: date) -> Optional[tuple[datetime, datetime]]:
    if shift.lunch_start_time is None or shift.lunch_end_time is None:
        return None
    lunch_start = datetime.combine(day, shift.lunch_start_time)
    lunch_end = datetime.combine(day, shift.lunch_end_time)
    if lunch_end <= lunch_start:
        # Tunda smena lunch'i ham kunni bosib o'tishi mumkin
        lunch_end = lunch_end + timedelta(days=1)
    return lunch_start, lunch_end


def is_within_lunch(shift: ShiftPolicy, event_dt: datetime) -> bool:
    window = lunch_window(shift, event_dt.date())
    if window is None:
        # Tunda smenada lunch boshqa kunga to'g'ri kelishi mumkin
        if shift.crosses_midnight:
            prev_window = lunch_window(shift, event_dt.date() - timedelta(days=1))
            if prev_window and prev_window[0] <= event_dt <= prev_window[1]:
                return True
        return False
    lunch_start, lunch_end = window
    if lunch_start <= event_dt <= lunch_end:
        return True
    if shift.crosses_midnight:
        prev_window = lunch_window(shift, event_dt.date() - timedelta(days=1))
        if prev_window and prev_window[0] <= event_dt <= prev_window[1]:
            return True
    return False


def has_prior_entry(previous_events: Iterable[DayEvent]) -> bool:
    return any(ev.door_event_type == "entry" for ev in previous_events)


def resolve_status(ctx: StatusContext) -> AttendanceStatus:
    """
    Pure status calculator. DB'ga umuman bormaydi.

    Tartib:
    1. Match status muammoli bo'lsa => maxsus status.
    2. Bayram / hafta oxiri => 'holiday' yoki 'weekend' (lekin event saqlanadi).
    3. Shift policy yo'q bo'lsa => default 'entry' / 'exit'.
    4. Entry door:
        - Tushlikda ichkariga kirsa => 'lunch_return'
        - Bugungi birinchi kirish:
            - Vaqtida kelgan (start + grace ichida) => 'on_time'
            - Kechikkan => 'late'
        - Birinchi emas => 'entry' (kun davomidagi takroriy kirish)
    5. Exit door:
        - Tushlikda chiqsa => 'lunch_out'
        - Oxirgi chiqish:
            - Vaqtida (end - grace dan keyin) => 'on_time_exit'
            - Erta => 'early_exit'
    """
    if ctx.match_status == "unmatched":
        return "unmatched_employee"
    if ctx.match_status == "ambiguous":
        return "ambiguous_employee"

    if ctx.is_holiday:
        # Event qayd etiladi, lekin status 'holiday' deb belgilanadi.
        # HR keyinchalik filterlay oladi.
        return "holiday"

    shift = ctx.shift
    if shift is None:
        return "entry" if ctx.door_event_type == "entry" else "exit"

    if shift.work_days and weekday_key(ctx.event_dt.date()) not in set(shift.work_days):
        return "weekend"

    if ctx.door_event_type == "entry":
        return _resolve_entry_status(ctx, shift)
    return _resolve_exit_status(ctx, shift)


def _resolve_entry_status(ctx: StatusContext, shift: ShiftPolicy) -> AttendanceStatus:
    if is_within_lunch(shift, ctx.event_dt):
        return "lunch_return"

    if has_prior_entry(ctx.previous_events):
        return "entry"

    # Birinchi kirish: shift start + grace bilan solishtiriladi
    day = ctx.event_dt.date()
    if shift.crosses_midnight and ctx.event_dt.time() < shift.work_start_time:
        # Tunda smena: event ertasi tongdayam bo'lishi mumkin
        day = day - timedelta(days=1)
    start_dt = datetime.combine(day, shift.work_start_time)
    deadline = start_dt + timedelta(minutes=shift.late_grace_minutes)
    return "late" if ctx.event_dt > deadline else "on_time"


def _resolve_exit_status(ctx: StatusContext, shift: ShiftPolicy) -> AttendanceStatus:
    if is_within_lunch(shift, ctx.event_dt):
        return "lunch_out"

    day = ctx.event_dt.date()
    end_dt = datetime.combine(day, shift.work_end_time)
    if shift.crosses_midnight:
        if ctx.event_dt.time() < shift.work_start_time:
            # Hozirgi event ertangi yarim — start kechagi kun
            end_dt = datetime.combine(day, shift.work_end_time)
        else:
            end_dt = datetime.combine(day, shift.work_end_time) + timedelta(days=1)

    cutoff = end_dt - timedelta(minutes=shift.early_leave_grace_minutes)
    return "on_time_exit" if ctx.event_dt >= cutoff else "early_exit"


def normalize_previous_exit_statuses(
    events: list[DayEvent],
    final_status: AttendanceStatus,
) -> list[AttendanceStatus]:
    """
    Bir kun ichida bir nechta exit bo'lsa, oxirgisidan oldingilarini 'exit'
    statusiga normallashtiradi (chunki final 'on_time_exit' yoki 'early_exit'
    faqat oxirgi chiqishga taalluqli).
    Bu DB ga emas, ko'rsatiladigan ro'yxatga ta'sir qiladi.
    """
    if final_status not in ("on_time_exit", "early_exit"):
        return []
    out: list[AttendanceStatus] = []
    for ev in events:
        if ev.door_event_type == "exit":
            out.append("exit")
        else:
            out.append("entry")
    return out
