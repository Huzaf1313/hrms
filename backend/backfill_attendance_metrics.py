"""Repair the worked-time and overtime numbers on existing attendance records.

Overtime used to be written once, when the record was created or last edited,
and never recomputed afterwards. Assigning a shift to an employee, correcting
a forgotten punch-out, or approving a regularisation all changed the punch
times or the shift without touching the numbers derived from them, so those
rows kept reporting zero overtime no matter what the times said.

The read path now recomputes on every request, which fixes the display
immediately. This script writes the corrected values back to the database so
the stored numbers stop disagreeing with what the application shows.

    cd backend

    Preview only, changes nothing:

        python backfill_attendance_metrics.py

    Write the corrections:

        python backfill_attendance_metrics.py --apply

    Limit the pass to a date range:

        python backfill_attendance_metrics.py --since 2026-09-25 --apply

    Also convert pre-2026-09-03 regularisation times, and copy the employee's
    current shift onto records that never had one:

        python backfill_attendance_metrics.py --apply --fix-legacy-tz \
            --fill-missing-shifts

Every row is printed as a before/after diff so the effect can be reviewed
before anything is written.

Scope
-----
Rows created before the shift feature carry no shift snapshot, and their
stored total_hours was written by older code that measured differently, so
recomputing them overwrites seeded values rather than repairing a bug. Use
--since to target the records you actually want rewritten.

Legacy timezone
---------------
Regularisation requests ask for a wall-clock time through a datetime-local
input. Before commit 5fbb78a that value was stored verbatim, so a naive
13:00 actually meant 13:00 IST. Afterwards it is converted to UTC first. The
punch endpoints have always stored UTC. Rows written before the change are
therefore 5h30m out, and ``--fix-legacy-tz`` moves them onto UTC.

A punch value is only converted when it is byte-identical to a
regularisation request that predates the change, which is what makes the
conversion safe: the employee punch endpoints always carry sub-second
precision, so a real punch can never collide with a whole-minute regularisation
value.
"""

import argparse
import asyncio
from datetime import date, datetime, time, timedelta, timezone

from bson import ObjectId

from app.db.database import database
from app.services.attendance_calculation import (
    compute_work_metrics,
    format_minutes_display,
    shift_duration_minutes,
)


IST = timezone(timedelta(hours=5, minutes=30))

# When normalize_requested_time landed. Regularisation requests created before
# this stored the wall-clock time verbatim rather than converting to UTC.
LEGACY_TZ_CUTOFF = datetime(2026, 9, 3, 17, 49, 19, tzinfo=IST)

# Fields that can hold a punch time. Employee punches write check_in /
# check_out; the admin mark-attendance and regularisation paths write in_time /
# out_time. Both pairs exist on the same collection, sometimes on the same
# document, so all four are considered.
PUNCH_FIELDS = ("check_in", "check_out", "in_time", "out_time")

# Values derived from the punch times, and so stale whenever they change.
METRIC_FIELDS = (
    "worked_minutes",
    "overtime_minutes",
    "late_minutes",
    "is_overnight",
    "total_hours",
)


def display(minutes):
    if minutes is None:
        return "--"

    hours, remainder = divmod(int(minutes), 60)

    return f"{hours}h {remainder}m"


def resolve_record_shift(record, employees, shifts):
    """Decide the shift a record should be measured against.

    Prefers the snapshot already on the record so the script never rewrites
    which shift applied on a given day. Only a record with no snapshot at all
    falls back to the employee's currently assigned shift, and only when the
    caller allows it.
    """
    shift_start = record.get("shift_start")
    shift_end = record.get("shift_end")
    shift_id = record.get("shift_id")

    if shift_start and shift_end:
        return {
            "shift_id": str(shift_id) if shift_id else None,
            "shift_name": record.get("shift") or "General",
            "shift_start": shift_start,
            "shift_end": shift_end,
            "shift_duration_minutes": record.get("shift_duration_minutes")
            or shift_duration_minutes(shift_start, shift_end),
            "shift_filled": False,
        }

    if not shift_id:
        employee = employees.get(record.get("employee_id"))

        if employee:
            shift_id = employee.get("shift_id")

    shift = shifts.get(str(shift_id)) if shift_id else None

    if not shift:
        return {
            "shift_id": str(shift_id) if shift_id else None,
            "shift_name": record.get("shift") or "General",
            "shift_start": None,
            "shift_end": None,
            "shift_duration_minutes": None,
            "shift_filled": False,
        }

    start_time = shift.get("start_time")
    end_time = shift.get("end_time")

    return {
        "shift_id": str(shift["_id"]),
        "shift_name": shift.get("name") or "General",
        "shift_start": start_time,
        "shift_end": end_time,
        "shift_duration_minutes": shift_duration_minutes(
            start_time, end_time
        ),
        "shift_filled": True,
    }


async def collect_shifts(collection):
    shifts = {}

    async for shift in collection.find({}):
        shifts[str(shift["_id"])] = shift

    return shifts


async def collect_employees(collection):
    employees = {}

    async for employee in collection.find(
        {"employee_id": {"$exists": True}}
    ):
        employees[employee["employee_id"]] = employee

    return employees


async def collect_legacy_ist_punches(collection):
    """Punch values that legacy regularisations wrote as naive IST.

    Requires both conditions to hold: the request predates the timezone fix,
    and the value actually reached the attendance record. The second condition
    is what keeps real punches out, since they always carry microseconds and a
    datetime-local regularisation value never does.
    """
    legacy = {}

    async for request in collection.find(
        {
            "created_at": {"$lt": LEGACY_TZ_CUTOFF},
            "attendance_id": {"$exists": True},
        }
    ):
        values = set()

        for field in ("requested_check_in", "requested_check_out"):
            value = request.get(field)

            if isinstance(value, datetime):
                values.add(value)

        if not values:
            continue

        legacy.setdefault(str(request["attendance_id"]), set()).update(
            values
        )

    return legacy


async def build_plan(fill_missing_shifts, fix_legacy_tz, since, until):
    shifts = await collect_shifts(database["shifts"])
    employees = await collect_employees(database["users"])
    legacy_punches = (
        await collect_legacy_ist_punches(
            database["employee_attendance_regularization"]
        )
        if fix_legacy_tz
        else {}
    )

    query = {}

    if since or until:
        window = {}

        if since:
            window["$gte"] = datetime.combine(since, time.min)

        if until:
            window["$lte"] = datetime.combine(until, time.max)

        query["date"] = window

    plan = []
    tz_shifted = 0

    async for record in database["employee_attendance"].find(query):
        record_id = str(record["_id"])
        record_date = record.get("date")

        if hasattr(record_date, "date"):
            record_date = record_date.date()

        working = {field: record.get(field) for field in PUNCH_FIELDS}
        candidates = legacy_punches.get(record_id, set())

        shift = resolve_record_shift(record, employees, shifts)

        if shift["shift_filled"] and not fill_missing_shifts:
            continue

        # Convert first: moving the instants changes the elapsed time, so the
        # conversion has to happen before anything is measured.
        converted_fields = 0

        for field, value in working.items():
            if not isinstance(value, datetime) or value not in candidates:
                continue

            # A legacy value is a wall clock stored without a zone, so Mongo
            # hands it back already tagged UTC even though it is really IST.
            # Re-reading it as IST and converting is the whole fix; a bare
            # astimezone(utc) would be a no-op and silently change nothing.
            working[field] = value.replace(tzinfo=IST).astimezone(
                timezone.utc
            )
            converted_fields += 1

        in_time = working["in_time"] or working["check_in"]
        out_time = working["out_time"] or working["check_out"]

        metrics = compute_work_metrics(
            in_time,
            out_time,
            shift_duration=shift["shift_duration_minutes"],
            shift_start=shift["shift_start"],
        )

        if metrics.worked_minutes is None:
            # Nothing measurable. Leave the row alone rather than replacing a
            # working set of numbers with nulls.
            continue

        # Counted here, not at conversion time, so the reported total matches
        # what --apply actually writes.
        tz_shifted += converted_fields

        corrected = {
            "shift_id": shift["shift_id"],
            "shift": shift["shift_name"],
            "shift_start": shift["shift_start"],
            "shift_end": shift["shift_end"],
            "shift_duration_minutes": shift["shift_duration_minutes"],
            "working_hours": format_minutes_display(
                metrics.worked_minutes
            ),
            "worked_minutes": metrics.worked_minutes,
            "overtime_minutes": metrics.overtime_minutes,
            "late_minutes": metrics.late_minutes,
            "is_overnight": metrics.is_overnight,
            "total_hours": round(metrics.worked_minutes / 60, 2),
        }

        for field in PUNCH_FIELDS:
            if working[field] is not None:
                corrected[field] = working[field]

        changes = {
            field: (record.get(field), corrected[field])
            for field in METRIC_FIELDS
            if record.get(field) != corrected[field]
        }

        times_changed = any(
            working[field] != record.get(field) for field in PUNCH_FIELDS
        )
        shift_changed = any(
            record.get(field) != corrected[field]
            for field in (
                "shift_id",
                "shift_start",
                "shift_end",
                "shift_duration_minutes",
            )
        )

        if not changes and not shift_changed and not times_changed:
            continue

        plan.append(
            {
                "object_id": record["_id"],
                "employee_id": record.get("employee_id"),
                "date": record_date,
                "flags": [
                    name
                    for name, on in (
                        ("TIMES", times_changed),
                        ("SHIFT", shift_changed),
                        ("SHIFT FILLED", shift["shift_filled"]),
                    )
                    if on
                ],
                "changes": changes,
                "corrections": corrected,
            }
        )

    return plan, tz_shifted


def print_plan(plan, tz_shifted):
    print(f"Rows needing a correction: {len(plan)}")
    print(f"Legacy IST punch values converted: {tz_shifted}")
    print()

    for entry in plan:
        flags = f"  [{', '.join(entry['flags'])}]" if entry["flags"] else ""
        print(f"{entry['employee_id']}  {entry['date']}{flags}")

        for field, (before, after) in entry["changes"].items():
            if field in ("worked_minutes", "overtime_minutes", "late_minutes"):
                print(
                    f"    {field:<18} {display(before)}"
                    f" -> {display(after)}"
                )
            else:
                print(f"    {field:<18} {before!r} -> {after!r}")

        print()


async def apply_plan(plan):
    attendance = database["employee_attendance"]

    for entry in plan:
        await attendance.update_one(
            {"_id": entry["object_id"]},
            {"$set": entry["corrections"]},
        )

    print(f"Updated {len(plan)} record(s)")


async def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="write the corrections (default is a preview only)",
    )
    parser.add_argument(
        "--fix-legacy-tz",
        action="store_true",
        help=(
            "convert pre-2026-09-03 regularisation punch times from naive IST "
            "to UTC. Those rows are currently 5h30m out."
        ),
    )
    parser.add_argument(
        "--fill-missing-shifts",
        action="store_true",
        help=(
            "also copy the employee's currently assigned shift onto records "
            "that were punched before any shift existed. Off by default: on "
            "older records today's shift rarely matches what the employee "
            "actually worked, and it produces large bogus lateness figures."
        ),
    )
    parser.add_argument(
        "--since",
        type=date.fromisoformat,
        help="only consider records on or after this date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--until",
        type=date.fromisoformat,
        help="only consider records on or before this date (YYYY-MM-DD)",
    )
    args = parser.parse_args()

    plan, tz_shifted = await build_plan(
        fill_missing_shifts=args.fill_missing_shifts,
        fix_legacy_tz=args.fix_legacy_tz,
        since=args.since,
        until=args.until,
    )

    print_plan(plan, tz_shifted)

    if not args.apply:
        print("Dry run. Nothing was written. Re-run with --apply to save.")
        return

    if not plan:
        print("Nothing to do.")
        return

    await apply_plan(plan)
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())