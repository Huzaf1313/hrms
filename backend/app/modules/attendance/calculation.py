"""Pure attendance arithmetic: worked time, lateness and overtime.

Kept free of database access so the rules stay testable and are reused by
every write path that touches an attendance record.

Two different kinds of time maths live here, and mixing them up is the
classic source of bugs:

1. Durations ("how long did they work") need *absolute instants*. A night
   shift of 18:30 -> 03:30 is nine hours, and only a real date on the value
   can prove that. This is what :func:`parse_instant` does.

2. Clock comparisons ("did they arrive after the shift started") need the
   *wall clock* in business time (IST). A punch at 01:00 during an
   18:30 -> 03:30 night shift is not late, and only wall-clock minutes can
   show that. This is what :func:`parse_clock_minutes` does.

Overtime itself is deliberately simple and is measured against hours
*actually worked*, not against the shift's end time, so arriving late simply
moves the whole window instead of eating into it:

    overtime = max(0, worked_minutes - shift_duration_minutes)
"""

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


# Business timezone. Matches the existing attendance service, which treats
# legacy naive datetimes as IST wall-clock values rather than UTC.
IST = timezone(timedelta(hours=5, minutes=30))

MINUTES_PER_DAY = 24 * 60

# Formats accepted for a bare time with no date, e.g. "09:30 AM" or "18:30".
CLOCK_FORMATS = ("%I:%M %p", "%I:%M%p", "%H:%M")

# e.g. "09:30 AM"
DISPLAY_CLOCK_RE = re.compile(r"^\d{1,2}:\d{2}\s*[AP]M$", re.IGNORECASE)


@dataclass
class WorkMetrics:
    """Result of measuring one attendance record against a shift."""

    # Total time on duty, in minutes. None when it cannot be determined
    # (missing punch, or times stored in a format we cannot read).
    worked_minutes: int | None = None

    # Minutes worked beyond the shift length. Never negative.
    overtime_minutes: int = 0

    # Minutes after the shift's start time. Never negative.
    late_minutes: int = 0

    # True when punch-out belongs to the following calendar day.
    is_overnight: bool = False

    @property
    def is_overtime(self) -> bool:
        return self.overtime_minutes > 0

    @property
    def is_late(self) -> bool:
        return self.late_minutes > 0


def _iter_candidate_times(text: str):
    """Yield datetime candidates for a string, trying each known format."""
    for time_format in CLOCK_FORMATS:
        try:
            yield datetime.strptime(text, time_format)
        except ValueError:
            continue

    # ISO datetimes, with or without a trailing Z / explicit offset.
    try:
        iso_text = text if text.endswith("Z") or "+" in text else f"{text}Z"
        yield datetime.fromisoformat(iso_text.replace("Z", "+00:00"))
    except ValueError:
        return


def parse_instant(value) -> datetime | None:
    """Parse a punch time into an absolute instant, normalised to naive UTC.

    Returns None when the value is missing or unparseable. Naive values are
    assumed to already be UTC, matching the employee punch-in endpoint.
    """
    if value is None:
        return None

    if isinstance(value, datetime):
        if value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)

        return value

    if isinstance(value, str):
        text = value.strip()

        if not text:
            return None

        for candidate in _iter_candidate_times(text):
            if candidate.tzinfo is not None:
                return candidate.astimezone(timezone.utc).replace(tzinfo=None)

            return candidate

    return None


def parse_clock_minutes(value) -> int | None:
    """Parse a punch time into business-timezone minutes since midnight.

    Returns None when the value is missing or unparseable.
    """
    if value is None:
        return None

    if isinstance(value, datetime):
        if value.tzinfo is None:
            # Legacy records stored local wall-clock values without a
            # timezone. They are already IST, not UTC.
            value = value.replace(tzinfo=IST)

        local = value.astimezone(IST)

        return local.hour * 60 + local.minute

    if isinstance(value, str):
        text = value.strip()

        if not text:
            return None

        # Already a display string such as "09:30 AM".
        if DISPLAY_CLOCK_RE.match(text):
            for candidate in _iter_candidate_times(text):
                return candidate.hour * 60 + candidate.minute

            return None

        for candidate in _iter_candidate_times(text):
            if candidate.tzinfo is not None:
                local = candidate.astimezone(IST)

                return local.hour * 60 + local.minute

            return candidate.hour * 60 + candidate.minute

    return None


def shift_duration_minutes(start_time, end_time) -> int | None:
    """Minutes from start to end, wrapping past midnight for night shifts.

    09:30 -> 18:30 is 540. 18:30 -> 03:30 is also 540, not -900.
    Identical start and end is treated as a full 24 hours, since that is the
    only reading under which the shift is a real working day.
    """
    start = parse_clock_minutes(start_time)
    end = parse_clock_minutes(end_time)

    if start is None or end is None:
        return None

    if start == end:
        return MINUTES_PER_DAY

    return (end - start) % MINUTES_PER_DAY


def shift_is_overnight(start_time, end_time) -> bool:
    start = parse_clock_minutes(start_time)
    end = parse_clock_minutes(end_time)

    if start is None or end is None or start == end:
        return False

    return end < start


def compute_work_metrics(
    in_time,
    out_time,
    shift_duration: int | None = None,
    shift_start: str | None = None,
    grace_period_minutes: int | None = 0,
) -> WorkMetrics:
    """Measure one attendance record.

    shift_duration / shift_start are minutes and a clock value respectively;
    both are optional so records from employees with no assigned shift still
    produce a sensible worked-time figure with zero overtime.
    """
    metrics = WorkMetrics()

    in_instant = parse_instant(in_time)
    out_instant = parse_instant(out_time)

    if in_instant is not None and out_instant is not None:
        worked = int((out_instant - in_instant).total_seconds() // 60)

        if worked < 0:
            # Punch-out landed on an earlier clock reading than punch-in, so
            # it belongs to the next day. A zero gap is left at zero rather
            # than being read as a full 24 hours: identical clock times with
            # no date information is far more likely a data-entry mistake.
            worked += MINUTES_PER_DAY

        metrics.worked_minutes = worked

    in_clock = parse_clock_minutes(in_time)
    out_clock = parse_clock_minutes(out_time)

    if in_clock is not None and out_clock is not None:
        if out_clock < in_clock:
            metrics.is_overnight = True

    if shift_start is not None and in_clock is not None:
        start_clock = parse_clock_minutes(shift_start)

        if start_clock is not None:
            # max() keeps a punch that lands during a night shift (01:00 on
            # an 18:30 -> 03:30 shift) from counting as hours of lateness.
            raw_late = max(0, in_clock - start_clock)
            grace = grace_period_minutes if grace_period_minutes is not None else 0
            if raw_late > grace:
                metrics.late_minutes = raw_late
            else:
                metrics.late_minutes = 0

    if metrics.worked_minutes is not None and shift_duration:
        metrics.overtime_minutes = max(
            0, metrics.worked_minutes - shift_duration
        )

    return metrics


def resolve_punch_times(record: dict) -> tuple:
    """Pull the punch-in / punch-out values off a stored attendance document.

    Two different field pairs write to the same collection: the employee punch
    endpoints write ``check_in`` / ``check_out``, the admin mark-attendance and
    regularisation paths write ``in_time`` / ``out_time``. Readers have to
    understand both, otherwise half the records measure as "no punch" and lose
    their overtime.
    """
    in_time = record.get("in_time") or record.get("check_in")
    out_time = record.get("out_time") or record.get("check_out")

    return in_time, out_time


def resolve_record_metrics(record: dict) -> WorkMetrics:
    """Measure a stored attendance document against its shift snapshot.

    This is the read-side counterpart to the write paths. It deliberately
    recomputes rather than trusting ``overtime_minutes`` on the document,
    because that field is a snapshot taken when the record was written: if the
    punch times were later corrected, or a shift was assigned after the fact,
    the stored value is stale and would keep reporting zero overtime forever.

    Stored values are only used when the punches cannot be measured at all,
    so a record with unparseable times still shows something sensible.
    """
    in_time, out_time = resolve_punch_times(record)

    shift_duration = record.get("shift_duration_minutes")

    if shift_duration is None:
        shift_duration = shift_duration_minutes(
            record.get("shift_start"),
            record.get("shift_end"),
        )

    metrics = compute_work_metrics(
        in_time,
        out_time,
        shift_duration=shift_duration,
        shift_start=record.get("shift_start"),
        grace_period_minutes=record.get("grace_period_minutes"),
    )

    if metrics.worked_minutes is not None:
        return metrics

    # No usable punches: fall back to whatever was written at the time so the
    # record still renders.
    metrics.worked_minutes = record.get("worked_minutes")
    metrics.overtime_minutes = record.get("overtime_minutes") or 0
    metrics.late_minutes = record.get("late_minutes") or 0
    metrics.is_overnight = bool(record.get("is_overnight", False))

    return metrics


def format_minutes_display(minutes: int | None) -> str | None:
    """615 -> "10hr 15min". Matches the existing working-hours display."""
    if minutes is None:
        return None

    if minutes < 0:
        minutes = 0

    hours, remainder = divmod(int(minutes), 60)

    return f"{hours}hr {remainder}min"


def format_minutes_compact(minutes: int | None) -> str | None:
    """615 -> "10h 15m". Compact form for overtime and late columns."""
    if minutes is None:
        return None

    if minutes <= 0:
        return None

    hours, remainder = divmod(int(minutes), 60)

    if hours and remainder:
        return f"{hours}h {remainder}m"

    if hours:
        return f"{hours}h"

    return f"{remainder}m"


def clock_minutes_to_display(minutes: int | None) -> str | None:
    """570 -> "09:30 AM"."""
    if minutes is None:
        return None

    normalised = minutes % MINUTES_PER_DAY

    hour = normalised // 60
    minute = normalised % 60

    suffix = "AM" if hour < 12 else "PM"

    display_hour = hour % 12
    if display_hour == 0:
        display_hour = 12

    return f"{display_hour:02d}:{minute:02d} {suffix}"
