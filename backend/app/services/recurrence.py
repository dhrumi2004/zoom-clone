"""Recurring meetings: one Meeting ID, and `scheduled_start` always points at the next occurrence."""
import calendar
from datetime import datetime, timedelta
from typing import Iterator, Optional

from ..models import Meeting, Recurrence


def add_interval(start: datetime, recurrence: Recurrence) -> datetime:
    if recurrence == Recurrence.DAILY:
        return start + timedelta(days=1)
    if recurrence == Recurrence.WEEKLY:
        return start + timedelta(weeks=1)
    if recurrence == Recurrence.MONTHLY:
        # Same day next month, clamped (Jan 31 -> Feb 28/29)
        year, month = (start.year + 1, 1) if start.month == 12 else (start.year, start.month + 1)
        day = min(start.day, calendar.monthrange(year, month)[1])
        return start.replace(year=year, month=month, day=day)
    raise ValueError("Not a recurring meeting")


def occurrences(meeting: Meeting, until: datetime) -> Iterator[datetime]:
    """Start times from the next occurrence up to `until` (and the series end date)."""
    start = meeting.scheduled_start
    while start is not None and start < until:
        if meeting.recurrence_end and start.date() > meeting.recurrence_end:
            return
        yield start
        if meeting.recurrence == Recurrence.NONE:
            return
        start = add_interval(start, meeting.recurrence)


def next_occurrence_after(meeting: Meeting, now: datetime) -> Optional[datetime]:
    """The first occurrence that hasn't finished yet, or None when the series is over."""
    if meeting.recurrence == Recurrence.NONE or meeting.scheduled_start is None:
        return None
    duration = timedelta(minutes=meeting.duration_min or 60)
    start = meeting.scheduled_start
    while start + duration <= now:
        start = add_interval(start, meeting.recurrence)
    if meeting.recurrence_end and start.date() > meeting.recurrence_end:
        return None
    return start
