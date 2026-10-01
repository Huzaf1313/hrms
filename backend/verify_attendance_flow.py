"""Exercises the real AttendanceService write paths against stub repositories,
so the fields actually persisted for a day are verified, not just the maths.

    cd backend
    python verify_attendance_flow.py
"""

import asyncio
import re
from datetime import date, datetime

from app.services.attendance_service import (
    AttendanceService,
    record_has_overtime,
)


failures = []


def check(label, actual, expected):
    ok = actual == expected
    print(f"{'PASS' if ok else 'FAIL'}  {label}: got {actual!r}, want {expected!r}")
    if not ok:
        failures.append(label)


NIGHT = {
    "_id": "shift-night",
    "name": "Night",
    "start_time": "18:30",
    "end_time": "03:30",
    "is_active": True,
}
MORNING = {
    "_id": "shift-morning",
    "name": "Morning",
    "start_time": "09:00",
    "end_time": "18:00",
    "is_active": True,
}

EMPLOYEE = {
    "_id": "emp-mongo-1",
    "employee_id": "EMP001",
    "first_name": "Asha",
    "last_name": "Rao",
    "department_id": "dept-1",
    "shift_id": "shift-night",
}

DEPARTMENT = {"_id": "dept-1", "name": "Operations"}

EMPLOYEE_WITHOUT_SHIFT = {
    key: value for key, value in EMPLOYEE.items() if key != "shift_id"
}


class StubShiftRepository:
    def __init__(self, shifts):
        self._shifts = {shift["_id"]: shift for shift in shifts}

    async def get_by_id(self, shift_id):
        return self._shifts.get(shift_id)


class StubAttendanceRepository:
    def __init__(self):
        self.saved = None
        self._id = 0

    async def get_by_id(self, attendance_id):
        return self.saved

    async def get_all(self, filters, skip, limit):
        return [self.saved] if self.saved else []

    async def get_distinct_employee_ids(self, filters):
        return [self.saved["employee_id"]] if self.saved else []

    async def get_status_counts(self, filters):
        return {}

    async def get_by_employee_and_date(self, employee_id, attendance_date):
        if self.saved and self.saved["employee_id"] == employee_id:
            return self.saved

        return None

    async def create(self, record):
        self._id += 1
        self.saved = {**record, "_id": f"att-{self._id}"}
        return self.saved

    async def update(self, attendance_id, update_data):
        self.saved = {**self.saved, **update_data, "_id": attendance_id}
        return self.saved


class StubEmployeeRepository:
    # Records the filter each call receives so the tests can assert what the
    # service asked Mongo for.
    last_filters = None

    async def get_by_id(self, employee_id):
        return EMPLOYEE

    async def get_by_employee_id(self, employee_id):
        return EMPLOYEE

    async def get_all(self, filters, skip, limit):
        StubEmployeeRepository.last_filters = filters
        return [EMPLOYEE]


class StubDepartmentRepository:
    async def get_by_id(self, department_id):
        return DEPARTMENT

    async def get_all(self, filters, skip, limit):
        return [DEPARTMENT]


def build_service(shifts):
    service = AttendanceService()
    service.repository = StubAttendanceRepository()
    service.employee_repository = StubEmployeeRepository()
    service.department_repository = StubDepartmentRepository()
    service.shift_repository = StubShiftRepository(shifts)

    return service


async def mark(service, **overrides):
    payload = {
        "employee_id": "EMP001",
        "date": date(2026, 9, 30),
        "status": "present",
        "in_time": None,
        "out_time": None,
        "shift_id": None,
        "shift": None,
        "shift_start": None,
        "shift_end": None,
    }
    payload.update(overrides)

    return await service.mark_attendance(payload)


async def main():
    print("--- night shift 18:30-03:30 (9h), employee assigned to it ---")
    service = build_service([NIGHT, MORNING])

    # Punch in 18:30, out 03:30 -> exactly 9h, no overtime.
    response = await mark(service, in_time="18:30", out_time="03:30")
    check("shift name from employee assignment", response.shift, "Night")
    check("shift duration", response.shift_duration_minutes, 540)
    check("worked across midnight", response.worked_minutes, 540)
    check("no overtime", response.overtime_minutes, 0)
    check("flagged as ending next day", response.is_overnight, True)
    check("shift_id persisted", response.shift_id, "shift-night")
    check("persisted is_overnight", service.repository.saved["is_overnight"], True)

    print("\n--- night shift with 10h30m worked -> 1h30m overtime ---")
    service = build_service([NIGHT, MORNING])
    response = await mark(service, in_time="18:30", out_time="05:00")
    check("worked", response.worked_minutes, 630)
    check("overtime minutes", response.overtime_minutes, 90)
    check("overtime display", response.overtime_display, "1h 30m")
    check("is_overtime", response.is_overtime, True)
    check("no lateness", response.late_minutes, 0)

    print("\n--- night shift, arrived 30m late but worked full 9h ---")
    service = build_service([NIGHT, MORNING])
    response = await mark(service, in_time="19:00", out_time="04:30")
    check("worked", response.worked_minutes, 570)
    check("overtime still earned", response.overtime_minutes, 30)
    check("late by 30m", response.late_minutes, 30)
    check("late display", response.late_display, "30m")
    check("both late and overtime", (response.is_late, response.is_overtime), (True, True))

    print("\n--- morning shift 09:00-18:00, 1h late, 9h worked ---")
    service = build_service([NIGHT, MORNING])
    # shift_id override: a one-day swap away from the assigned Night shift.
    response = await mark(
        service,
        in_time="10:00",
        out_time="19:00",
        shift_id="shift-morning",
    )
    check("override shift applied", response.shift, "Morning")
    check("worked 9h", response.worked_minutes, 540)
    check("late 1h", response.late_minutes, 60)
    check("no overtime", response.overtime_minutes, 0)

    print("\n--- morning shift, 10h worked -> 1h overtime ---")
    service = build_service([NIGHT, MORNING])
    response = await mark(
        service, in_time="09:00", out_time="19:00", shift_id="shift-morning"
    )
    check("worked", response.worked_minutes, 600)
    check("overtime", response.overtime_minutes, 60)
    check("overtime display", response.overtime_display, "1h")

    print("\n--- morning shift is NOT flagged as overnight ---")
    service = build_service([NIGHT, MORNING])
    response = await mark(
        service, in_time="09:00", out_time="18:00", shift_id="shift-morning"
    )
    check("same-day shift", response.is_overnight, False)

    print("\n--- employee with no shift assigned ---")
    class NoShiftEmployeeRepository:
        async def get_by_id(self, employee_id):
            return EMPLOYEE_WITHOUT_SHIFT

        async def get_by_employee_id(self, employee_id):
            return EMPLOYEE_WITHOUT_SHIFT

    service = build_service([NIGHT, MORNING])
    service.employee_repository = NoShiftEmployeeRepository()

    response = await mark(service, in_time="09:00", out_time="18:00")
    check("worked still measured", response.worked_minutes, 540)
    check("no overtime without a shift", response.overtime_minutes, 0)
    check("falls back to General label", response.shift, "General")

    print("\n--- re-marking a day keeps the shift already on the record ---")
    service = build_service([NIGHT, MORNING])
    await mark(service, in_time="18:30", out_time="03:30", shift_id="shift-morning")
    # Second edit with no shift specified must not fall back to the employee's
    # assigned Night shift.
    response = await mark(service, in_time="18:30", out_time="03:30")
    check("existing snapshot retained", response.shift, "Morning")
    check("duration retained", response.shift_duration_minutes, 540)
    check("still no overtime", response.overtime_minutes, 0)

    print("\n--- update_attendance recomputes after a time change ---")
    service = build_service([NIGHT, MORNING])
    await mark(service, in_time="18:30", out_time="03:30")
    attendance_id = service.repository.saved["_id"]
    response = await service.update_attendance(
        attendance_id, {"out_time": "05:00"}
    )
    check("worked recomputed", response.worked_minutes, 630)
    check("overtime recomputed", response.overtime_minutes, 90)
    check("shift untouched", response.shift, "Night")
    check("marked regularized", response.is_regularized, True)

    print("\n--- overtime filter helper ---")
    service = build_service([NIGHT, MORNING])
    await mark(service, in_time="18:30", out_time="05:00")
    check("detects stored overtime", record_has_overtime(service.repository.saved), True)

    service = build_service([NIGHT, MORNING])
    await mark(service, in_time="18:30", out_time="03:30")
    check("no overtime on exact shift", record_has_overtime(service.repository.saved), False)

    print("\n--- a legacy record with no shift_id or minutes ---")
    legacy = {
        "in_time": "09:00",
        "out_time": "20:00",
        "shift_start": "09:00",
        "shift_end": "18:00",
    }
    check("legacy 11h vs 9h shift = 2h OT", record_has_overtime(legacy), True)

    print("\n--- work_location filter ---")
    from app.utils.pagination import PaginationParams

    service = build_service([NIGHT, MORNING])

    # No location filter: the key must be absent entirely, not present as None.
    await service.get_attendance_list(
        attendance_date=date(2026, 9, 30),
        department_id=None,
        status=None,
        search=None,
        pagination=PaginationParams(page=1, limit=10),
    )
    filters = StubEmployeeRepository.last_filters
    check("no location key when unfiltered", "work_location" in filters, False)

    # Filtered: case-insensitive and anchored so regex metacharacters are safe.
    await service.get_attendance_list(
        attendance_date=date(2026, 9, 30),
        department_id=None,
        status=None,
        search=None,
        pagination=PaginationParams(page=1, limit=10),
        work_location="kolhapur",
    )
    filters = StubEmployeeRepository.last_filters
    pattern = filters.get("work_location", {})
    check("location filter is a regex", isinstance(pattern, dict), True)
    check("  case-insensitive", pattern.get("$options"), "i")
    check("  anchored", str(pattern.get("$regex", "")).startswith("^"), True)

    # Must match the real value regardless of case.
    check(
        "  matches 'Kolhapur' from 'kolhapur'",
        bool(
            re.match(
                pattern.get("$regex", ""),
                "Kolhapur",
                re.IGNORECASE,
            )
        ),
        True,
    )


    # A metacharacter in user input must stay literal, so it cannot widen the
    # match beyond the intended location.
    await service.get_attendance_list(
        attendance_date=date(2026, 9, 30),
        department_id=None,
        status=None,
        search=None,
        pagination=PaginationParams(page=1, limit=10),
        work_location="Kol.",
    )
    regex = StubEmployeeRepository.last_filters["work_location"]["$regex"]
    check(
        "  metacharacter '.' is escaped",
        bool(re.match(regex, "Kol.", re.IGNORECASE)),
        True,
    )
    check(
        "  metacharacter does not act as a wildcard",
        bool(re.match(regex, "KolX", re.IGNORECASE)),
        False,
    )

    # Anchored means a prefix must NOT match.
    await service.get_attendance_list(
        attendance_date=date(2026, 9, 30),
        department_id=None,
        status=None,
        search=None,
        pagination=PaginationParams(page=1, limit=10),
        work_location="Kolhapur",
    )
    regex = StubEmployeeRepository.last_filters["work_location"]["$regex"]
    check(
        "  does not match 'Kolhapur City'",
        bool(re.match(regex, "Kolhapur City", re.IGNORECASE)),
        False,
    )

    # Blank / whitespace-only input must be ignored rather than matching nothing.
    for blank in ("   ", "", None):
        await service.get_attendance_list(
            attendance_date=date(2026, 9, 30),
            department_id=None,
            status=None,
            search=None,
            pagination=PaginationParams(page=1, limit=10),
            work_location=blank,
        )
        filters = StubEmployeeRepository.last_filters
        check(f"blank location {blank!r} ignored", "work_location" in filters, False)

    print("\n--- work location options ---")

    class DistinctCollection:
        def __init__(self, values):
            self._values = values

        async def distinct(self, field, filters):
            self.last_field = field
            self.last_filters = filters
            return self._values

    class LocationsEmployeeRepository:
        def __init__(self, values):
            self.collection = DistinctCollection(values)

    service = build_service([NIGHT, MORNING])
    service.employee_repository = LocationsEmployeeRepository(
        ["Pune", "Kolhapur", None, "", "Amravati"]
    )

    options = await service.get_work_locations()
    check("blanks and nulls dropped", options, ["Amravati", "Kolhapur", "Pune"])

    print()
    if failures:
        print(f"{len(failures)} FAILED: {failures}")
        raise SystemExit(1)

    print("All flow checks passed.")


asyncio.run(main())
