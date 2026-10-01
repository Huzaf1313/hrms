"""Checks the shift/overtime arithmetic, especially the overnight case.

    cd backend
    python -c "import verify_shift_math"
"""

from app.services.attendance_calculation import (
    clock_minutes_to_display,
    compute_work_metrics,
    format_minutes_compact,
    format_minutes_display,
    parse_clock_minutes,
    shift_duration_minutes,
    shift_is_overnight,
)


failures = []


def check(label, actual, expected):
    ok = actual == expected
    print(f"{'PASS' if ok else 'FAIL'}  {label}: got {actual!r}, want {expected!r}")
    if not ok:
        failures.append(label)


print("--- shift durations ---")
check("General 09:30-18:30", shift_duration_minutes("09:30", "18:30"), 540)
check("Morning 09:00-18:00", shift_duration_minutes("09:00", "18:00"), 540)
check("Night 18:30-03:30 wraps midnight", shift_duration_minutes("18:30", "03:30"), 540)
check("part-time 13:00-17:00", shift_duration_minutes("13:00", "17:00"), 240)
check("identical times = 24h", shift_duration_minutes("09:00", "09:00"), 1440)
check("unparseable returns None", shift_duration_minutes("09:30", None), None)

print("\n--- overnight flag ---")
check("General is not overnight", shift_is_overnight("09:30", "18:30"), False)
check("Night is overnight", shift_is_overnight("18:30", "03:30"), True)

print("\n--- clock parsing ---")
check("09:30 AM", parse_clock_minutes("09:30 AM"), 570)
check("09:30 PM is 21:30", parse_clock_minutes("09:30 PM"), 1290)
check("07:30 PM is 19:30", parse_clock_minutes("07:30 PM"), 1170)
check("18:30 24h", parse_clock_minutes("18:30"), 1110)
check("03:30", parse_clock_minutes("03:30"), 210)
check("garbage -> None", parse_clock_minutes("not a time"), None)

print("\n--- MORNING SHIFT (9h), 09:00-18:00 ---")
m = compute_work_metrics("09:00", "18:00", shift_duration=540, shift_start="09:00")
check("on time, exactly 9h", (m.worked_minutes, m.overtime_minutes, m.late_minutes), (540, 0, 0))

m = compute_work_metrics("10:00", "18:00", shift_duration=540, shift_start="09:00")
check("1h late, still 8h worked", (m.worked_minutes, m.overtime_minutes, m.late_minutes), (480, 0, 60))

m = compute_work_metrics("10:00", "19:00", shift_duration=540, shift_start="09:00")
check("1h late but 9h worked -> 0 OT", (m.worked_minutes, m.overtime_minutes, m.late_minutes), (540, 0, 60))

m = compute_work_metrics("10:00", "20:00", shift_duration=540, shift_start="09:00")
check("1h late + 10h worked -> 1h OT", (m.worked_minutes, m.overtime_minutes, m.late_minutes), (600, 60, 60))

m = compute_work_metrics("09:00", "19:15", shift_duration=540, shift_start="09:00")
check("10h15m worked -> 1h15m OT", (m.worked_minutes, m.overtime_minutes), (615, 75))

print("\n--- NIGHT SHIFT (9h), 18:30-03:30 ---")
m = compute_work_metrics("18:30", "03:30", shift_duration=540, shift_start="18:30")
check("on time, exactly 9h across midnight", (m.worked_minutes, m.overtime_minutes, m.late_minutes), (540, 0, 0))
check("  is_overnight flag", m.is_overnight, True)

m = compute_work_metrics("19:00", "03:30", shift_duration=540, shift_start="18:30")
check("30m late, 8h30m worked", (m.worked_minutes, m.overtime_minutes, m.late_minutes), (510, 0, 30))

m = compute_work_metrics("19:00", "04:30", shift_duration=540, shift_start="18:30")
check("30m late but 9h30m worked -> 30m OT", (m.worked_minutes, m.overtime_minutes, m.late_minutes), (570, 30, 30))

m = compute_work_metrics("18:30", "05:00", shift_duration=540, shift_start="18:30")
check("worked to 5am -> 1h30m OT", (m.worked_minutes, m.overtime_minutes), (630, 90))

m = compute_work_metrics("01:00", "03:30", shift_duration=540, shift_start="18:30")
check("01:00 is mid-shift, not late", m.late_minutes, 0)

print("\n--- NIGHT SHIFT with real ISO dates ---")
m = compute_work_metrics(
    "2026-09-30T18:30:00+05:30",
    "2026-10-01T03:30:00+05:30",
    shift_duration=540,
    shift_start="18:30",
)
check("ISO across midnight = 9h", m.worked_minutes, 540)
check("ISO 0 OT", m.overtime_minutes, 0)

m = compute_work_metrics(
    "2026-09-30T18:30:00+05:30",
    "2026-10-01T05:00:00+05:30",
    shift_duration=540,
    shift_start="18:30",
)
check("ISO to 5am next day = 10h30m", m.worked_minutes, 630)
check("ISO 1h30m OT", m.overtime_minutes, 90)

print("\n--- edge cases ---")
m = compute_work_metrics("09:00", None, shift_duration=540, shift_start="09:00")
check("no punch-out -> no worked time", m.worked_minutes, None)
check("no punch-out -> 0 OT", m.overtime_minutes, 0)

m = compute_work_metrics("09:00", "09:00", shift_duration=540, shift_start="09:00")
check("identical in/out -> 0, not 24h", (m.worked_minutes, m.overtime_minutes), (0, 0))

m = compute_work_metrics("09:00", "17:00", shift_duration=None, shift_start=None)
check("no shift assigned -> 8h, 0 OT", (m.worked_minutes, m.overtime_minutes), (480, 0))

m = compute_work_metrics("09:00", "17:00", shift_duration=0, shift_start="09:00")
check("zero duration must not divide/err", m.overtime_minutes, 0)

print("\n--- display formatting ---")
check("615 min -> display", format_minutes_display(615), "10hr 15min")
check("615 -> compact", format_minutes_compact(615), "10h 15m")
check("90 -> compact", format_minutes_compact(90), "1h 30m")
check("60 -> compact", format_minutes_compact(60), "1h")
check("45 -> compact", format_minutes_compact(45), "45m")
check("0 -> compact None", format_minutes_compact(0), None)
check("570 -> 09:30 AM", clock_minutes_to_display(570), "09:30 AM")
check("1110 -> 06:30 PM", clock_minutes_to_display(1110), "06:30 PM")
check("0 -> 12:00 AM", clock_minutes_to_display(0), "12:00 AM")
check("720 -> 12:00 PM", clock_minutes_to_display(720), "12:00 PM")

print()
if failures:
    print(f"{len(failures)} FAILED: {failures}")
    raise SystemExit(1)

print("All checks passed.")
