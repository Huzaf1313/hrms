import re
from datetime import date, datetime, timezone, timedelta
IST = timezone(timedelta(hours=5, minutes=30))

from app.core.exceptions import AppException
from app.core.scope import scope_matches, visibility_scope
from app.repositories.attendance_repository import AttendanceRepository
from app.repositories.department_repository import DepartmentRepository
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.shift_repository import ShiftRepository
from app.schemas.attendance import (
    AttendanceListResponse,
    AttendanceResponse,
    AttendanceSummaryResponse,
    BulkAttendanceItemResult,
    BulkAttendanceMark,
    BulkAttendanceResponse,
    DepartmentPresence,
    EmployeeSummary,
    MyAttendanceStatus,
)
from app.services.attendance_calculation import (
    compute_work_metrics,
    format_minutes_compact,
    format_minutes_display,
    parse_instant,
    resolve_punch_times,
    resolve_record_metrics,
    shift_duration_minutes,
)
from app.utils.filtering import build_filter
from app.utils.pagination import PaginationParams


# Statuses that already have an explicit attendance record and therefore
# should NOT be re-counted as "absent" for employees with no record at all.
MARKED_STATUSES = {
    "present",
    "late",
    "on_leave",
    "working",
    "overtime",
    "missing_punch",
}

# Statuses that count towards "present today" for department-wise presence.
PRESENT_LIKE_STATUSES = {"present", "late", "working", "overtime"}


def to_datetime(value: date | None) -> datetime | None:
    """Mongo/BSON only stores datetime, not bare date - convert before saving."""
    if value is None:
        return None

    return datetime(value.year, value.month, value.day)


def business_today() -> date:
    """Return today's attendance date in the application's business timezone."""
    return datetime.now(IST).date()


def calculate_working_hours(
    in_time: str | None,
    out_time: str | None,
    shift_duration: int | None = None,
    shift_start: str | None = None,
) -> str | None:
    """Display string such as "9H 14M". Delegates to the shared calculator so
    overnight shifts are measured correctly."""
    metrics = compute_work_metrics(
        in_time,
        out_time,
        shift_duration=shift_duration,
        shift_start=shift_start,
    )

    if metrics.worked_minutes is None:
        return None

    hours, remainder = divmod(metrics.worked_minutes, 60)

    return f"{hours}H {remainder}M"

def format_punch_time(value) -> str | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        if value.tzinfo is None:
            # Legacy attendance records stored local wall-clock values
            # without a timezone. They are already IST, not UTC.
            value = value.replace(tzinfo=IST)
        ist_value = value.astimezone(IST)
        return ist_value.strftime("%I:%M %p")

    if isinstance(value, str):
        text = value.strip()

        # Already in "hh:mm AM/PM" format ΓÇö leave as-is.
        if re.match(r"^\d{1,2}:\d{2}\s*[AP]M$", text, re.IGNORECASE):
            return text

        # Plain 24-hour "HH:MM" string ΓÇö convert to 12-hour AM/PM.
        try:
            parsed = datetime.strptime(text, "%H:%M")
            return parsed.strftime("%I:%M %p")
        except ValueError:
            pass

        # ISO datetime string (with or without "Z") ΓÇö convert UTC to IST.
        try:
            iso_text = text if text.endswith("Z") or "+" in text else f"{text}Z"
            parsed_dt = datetime.fromisoformat(iso_text.replace("Z", "+00:00"))
            parsed_dt = parsed_dt.astimezone(IST)
            return parsed_dt.strftime("%I:%M %p")
        except ValueError:
            pass

        return text

    return str(value)


def format_total_hours(value) -> str | None:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        total_minutes = round(value * 60)
        hours = total_minutes // 60
        minutes = total_minutes % 60

        return f"{hours}hr {minutes}min"

    return str(value)


def record_shift_duration(record: dict) -> int | None:
    """Shift length for a stored record.

    Records written after overtime tracking carry shift_duration_minutes.
    Older ones only have the raw shift times, so the duration is derived from
    them rather than being lost.
    """
    stored = record.get("shift_duration_minutes")

    if stored is not None:
        return stored

    return shift_duration_minutes(
        record.get("shift_start"),
        record.get("shift_end"),
    )


def record_has_overtime(record: dict) -> bool:
    """Whether a stored attendance document has overtime, for filtering.

    Measured on the fly from the punch times rather than read off the
    document, so a record whose overtime was stored as 0 before its shift was
    known still reports correctly.
    """
    return resolve_record_metrics(record).overtime_minutes > 0


def record_overtime_minutes(record: dict) -> int:
    return resolve_record_metrics(record).overtime_minutes


class AttendanceService:
    def __init__(self):
        self.repository = AttendanceRepository()
        self.employee_repository = EmployeeRepository()
        self.department_repository = DepartmentRepository()
        self.shift_repository = ShiftRepository()

    
    @staticmethod
    def _created_by_scope(current_user: dict | None) -> dict:
        """See app.core.scope.visibility_scope."""
        return visibility_scope(current_user)

    def _assert_employee_access(
        self,
        employee: dict | None,
        current_user: dict | None,
    ) -> None:
        if not employee:
            raise AppException("Employee not found", 404)

        scope = self._created_by_scope(current_user)

        if not scope_matches(employee, scope):
            # Do not reveal that another team's employee exists.
            raise AppException("Employee not found", 404)

    async def _get_employee(
        self,
        employee_id: str,
        current_user: dict | None = None,
    ):
        employee = await self.employee_repository.get_by_id(employee_id)

        if not employee:
            employee = await self.employee_repository.get_by_employee_id(
                employee_id
            )

        if employee:
            self._assert_employee_access(employee, current_user)

        return employee


    async def _shift_by_id(self, shift_id: str | None) -> dict | None:
        if not shift_id:
            return None

        return await self.shift_repository.get_by_id(shift_id)

    async def _resolve_shift(
        self,
        employee: dict | None,
        data: dict,
        existing: dict | None = None,
    ) -> dict:
        """Decide which shift applies to a record, in priority order:

        1. An explicit ``shift_id`` on the request (a one-day override such as
           a shift swap).
        2. The shift already snapshotted on the record being re-marked, so a
           second edit does not silently discard the original shift.
        3. The employee's own assigned ``shift_id``.
        4. Explicit ``shift_start`` / ``shift_end`` times on the request, or
           failing that on the existing record.
        5. The legacy free-text ``shift`` label, which carries no duration and
           therefore yields zero overtime rather than a guess.

        The result is snapshotted onto the attendance document so that later
        edits to a shift never rewrite historical records.
        """
        shift = await self._shift_by_id(data.get("shift_id"))

        if shift is None and existing:
            shift = await self._shift_by_id(existing.get("shift_id"))

        if shift is None and employee:
            shift = await self._shift_by_id(employee.get("shift_id"))

        if shift:
            start_time = shift.get("start_time")
            end_time = shift.get("end_time")

            return {
                "shift_id": str(shift["_id"]),
                "shift": shift.get("name", "General"),
                "shift_start": start_time,
                "shift_end": end_time,
                "shift_duration_minutes": shift_duration_minutes(
                    start_time, end_time
                ),
            }

        shift_start = data.get("shift_start") or (
            existing.get("shift_start") if existing else None
        )
        shift_end = data.get("shift_end") or (
            existing.get("shift_end") if existing else None
        )

        shift_name = data.get("shift")

        if not shift_name and existing:
            shift_name = existing.get("shift")

        return {
            "shift_id": None,
            "shift": shift_name or "General",
            "shift_start": shift_start,
            "shift_end": shift_end,
            "shift_duration_minutes": shift_duration_minutes(
                shift_start, shift_end
            ),
        }


    async def _build_employee_summary_map(
        self,
        employee_ids: list[str],
    ) -> dict[str, dict]:
        """Batch-resolve employees + their department names, avoiding N+1 lookups."""
        employees_by_id: dict[str, dict] = {}

        for employee_id in set(employee_ids):
            employee = await self.employee_repository.get_by_id(employee_id)
            if employee:
                employees_by_id[employee_id] = employee

        department_ids = {
            employee["department_id"] for employee in employees_by_id.values()
        }
        departments_by_id: dict[str, dict] = {}

        for department_id in department_ids:
            department = await self.department_repository.get_by_id(department_id)
            if department:
                departments_by_id[department_id] = department

        return {
            "employees": employees_by_id,
            "departments": departments_by_id,
        }

    def _serialize(
        self,
        attendance: dict,
        employee: dict | None,
        department: dict | None,
    ) -> AttendanceResponse:
        in_time, out_time = resolve_punch_times(attendance)

        # Numeric minutes are the source of truth. They are recomputed from the
        # punch times on every read, because the value stored on the document
        # is a snapshot from whenever the record was written and goes stale the
        # moment the times are corrected or a shift is assigned.
        metrics = resolve_record_metrics(attendance)
        worked_minutes = metrics.worked_minutes
        overtime_minutes = metrics.overtime_minutes
        late_minutes = metrics.late_minutes
        is_overnight = metrics.is_overnight

        shift_duration = record_shift_duration(attendance)

        # Derived from the recomputed minutes rather than read off the record:
        # the stored working_hours / total_hours go stale for exactly the same
        # reason overtime does, and showing corrected overtime next to
        # uncorrected hours would be worse than either being wrong alone.
        if worked_minutes is not None:
            working_hours = format_minutes_display(worked_minutes)
        else:
            working_hours = attendance.get("working_hours")

            if working_hours is None:
                working_hours = attendance.get("total_hours")

        employee_summary = EmployeeSummary(
            id=str(employee["_id"]) if employee else attendance["employee_id"],
            employee_code=employee.get("employee_id", "-") if employee else "-",
            first_name=employee.get("first_name", "Unknown") if employee else "Unknown",
            last_name=employee.get("last_name", "") if employee else "",
            avatar_url=employee.get("avatar_url") if employee else None,
            department_id=attendance.get("department_id")
            or (employee.get("department_id", "") if employee else ""),
            department_name=department.get("name") if department else None,
        )

        return AttendanceResponse(
            id=str(attendance["_id"]),
            employee=employee_summary,
            date=attendance["date"].date(),
            shift_id=attendance.get("shift_id"),
            shift=attendance.get("shift", "General"),
            shift_start=attendance.get("shift_start"),
            shift_end=attendance.get("shift_end"),
            shift_duration_minutes=shift_duration,
            in_time=format_punch_time(
                in_time
            ),
            out_time=format_punch_time(
                out_time
            ),
            working_hours=format_total_hours(working_hours),
            worked_minutes=worked_minutes,
            overtime_minutes=overtime_minutes,
            overtime_display=format_minutes_compact(overtime_minutes),
            late_minutes=late_minutes,
            late_display=format_minutes_compact(late_minutes),
            is_overtime=overtime_minutes > 0,
            is_late=late_minutes > 0,
            is_overnight=bool(is_overnight),
            status=(attendance.get("status") or "present").lower(),
            is_regularized=attendance.get("is_regularized", False),
            notes=attendance.get("notes"),
        )


    async def _mark_single_employee(
        self,
        employee: dict,
        data: dict,
        marked_by: str | None = None,
    ) -> AttendanceResponse:
        attendance_date = to_datetime(data["date"])

        existing = await self.repository.get_by_employee_and_date(
            employee_id=employee["employee_id"],
            attendance_date=attendance_date,
        )
        if not existing and "_id" in employee:
            existing = await self.repository.get_by_employee_and_date(
                employee_id=str(employee["_id"]),
                attendance_date=attendance_date,
            )

        # Re-marking an existing day keeps the shift already on the record
        # unless the request overrides it.
        shift = await self._resolve_shift(employee, data, existing=existing)

        in_time = data.get("in_time")
        out_time = data.get("out_time")

        metrics = compute_work_metrics(
            in_time,
            out_time,
            shift_duration=shift["shift_duration_minutes"],
            shift_start=shift["shift_start"],
        )

        working_hours = (
            f"{metrics.worked_minutes // 60}H {metrics.worked_minutes % 60}M"
            if metrics.worked_minutes is not None
            else None
        )

        record = {
            "employee_id": employee["employee_id"],
            "department_id": employee.get("department_id"),
            "date": attendance_date,
            **shift,
            "in_time": in_time,
            "out_time": out_time,
            "working_hours": working_hours,
            "worked_minutes": metrics.worked_minutes,
            "overtime_minutes": metrics.overtime_minutes,
            "late_minutes": metrics.late_minutes,
            "is_overnight": metrics.is_overnight,
            "status": data["status"].lower() if data.get("status") else "present",
            "notes": data.get("notes"),
            "updated_at": datetime.utcnow(),
        }

        if existing:
            record["is_regularized"] = True
            attendance = await self.repository.update(
                str(existing["_id"]),
                record,
            )
        else:
            record["is_regularized"] = False
            record["marked_by"] = marked_by
            record["created_at"] = datetime.utcnow()
            attendance = await self.repository.create(record)

        department = None
        if employee.get("department_id"):
            department = await self.department_repository.get_by_id(
                employee["department_id"]
            )

        return self._serialize(attendance, employee, department)

    async def mark_attendance(
        self,
        data: dict,
        marked_by: str | None = None,
        current_user: dict | None = None,
    ):
        employee = await self._get_employee(
            data["employee_id"],
            current_user=current_user,
        )

        if not employee:
            raise AppException("Employee not found", 404)

        return await self._mark_single_employee(
            employee=employee,
            data=data,
            marked_by=marked_by,
        )

    async def bulk_mark_attendance(
        self,
        data: BulkAttendanceMark | dict,
        marked_by: str | None = None,
        current_user: dict | None = None,
    ) -> BulkAttendanceResponse:
        data_dict = data.model_dump() if hasattr(data, "model_dump") else data
        select_all_matching = data_dict.get("select_all_matching", False)
        excluded_ids = set(data_dict.get("excluded_employee_ids") or [])

        # List of (employee_dict | None, identifier)
        targets: list[tuple[dict | None, str]] = []

        if select_all_matching:
            roster = await self._get_matching_roster(
                attendance_date=data_dict.get("filter_date") or data_dict.get("date"),
                department_id=data_dict.get("department_id"),
                status=data_dict.get("filter_status"),
                search=data_dict.get("search"),
                shift_id=data_dict.get("filter_shift_id"),
                overtime_only=data_dict.get("overtime_only", False),
                work_location=data_dict.get("work_location"),
                current_user=current_user,
            )
            for _, emp in roster:
                emp_mongo_id = str(emp.get("_id", ""))
                emp_code = emp.get("employee_id", "")
                if emp_mongo_id in excluded_ids or emp_code in excluded_ids:
                    continue
                targets.append((emp, emp_code or emp_mongo_id))
        else:
            raw_ids = data_dict.get("employee_ids") or []
            for emp_id in raw_ids:
                if emp_id in excluded_ids:
                    continue
                try:
                    emp = await self._get_employee(emp_id, current_user=current_user)
                    targets.append((emp, emp_id))
                except AppException:
                    targets.append((None, emp_id))

        mark_payload = {
            "date": data_dict["date"],
            "status": data_dict["status"],
            "shift_id": data_dict.get("shift_id"),
            "shift": data_dict.get("shift"),
            "shift_start": data_dict.get("shift_start"),
            "shift_end": data_dict.get("shift_end"),
            "in_time": data_dict.get("in_time"),
            "out_time": data_dict.get("out_time"),
            "notes": data_dict.get("notes"),
        }

        results: list[BulkAttendanceItemResult] = []
        success_count = 0
        failure_count = 0

        for emp, identifier in targets:
            if not emp:
                failure_count += 1
                results.append(
                    BulkAttendanceItemResult(
                        employee_id=identifier,
                        employee_name=None,
                        employee_code=None,
                        success=False,
                        error="Employee not found or outside visibility scope",
                    )
                )
                continue

            emp_id_val = str(emp.get("_id", identifier))
            emp_code = emp.get("employee_id", "-")
            emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()

            try:
                self._assert_employee_access(emp, current_user)
                attendance = await self._mark_single_employee(
                    employee=emp,
                    data=mark_payload,
                    marked_by=marked_by,
                )
                success_count += 1
                results.append(
                    BulkAttendanceItemResult(
                        employee_id=emp_id_val,
                        employee_name=emp_name,
                        employee_code=emp_code,
                        success=True,
                        attendance=attendance,
                    )
                )
            except Exception as exc:
                failure_count += 1
                err_msg = exc.message if isinstance(exc, AppException) else str(exc)
                results.append(
                    BulkAttendanceItemResult(
                        employee_id=emp_id_val,
                        employee_name=emp_name,
                        employee_code=emp_code,
                        success=False,
                        error=err_msg,
                    )
                )

        return BulkAttendanceResponse(
            total=len(results),
            success_count=success_count,
            failure_count=failure_count,
            results=results,
        )


    
    async def get_attendance(
        self,
        attendance_id: str,
        current_user: dict | None = None,
    ):
        attendance = await self.repository.get_by_id(attendance_id)

        if not attendance:
            raise AppException("Attendance record not found", 404)

        employee = await self._get_employee(
            attendance["employee_id"],
            current_user=current_user,
        )

        department = (
            await self.department_repository.get_by_id(
                attendance["department_id"]
            )
            if attendance.get("department_id")
            else None
        )

        return self._serialize(attendance, employee, department)


    async def get_my_status(
        self,
        employee_id: str,
        attendance_date: date,
    ) -> MyAttendanceStatus:
        """Employee self-service: today's (or any date's) status/in/out time.
        Returns status=None with everything else blank if nothing was marked
        for that date yet - this is a normal "not clocked in yet" state, not
        an error."""
        record = await self.repository.get_by_employee_and_date(
            employee_id=employee_id,
            attendance_date=to_datetime(attendance_date),
        )

        if not record:
            return MyAttendanceStatus(date=attendance_date)

        return MyAttendanceStatus(
            date=attendance_date,
            status=record.get("status") or "present",
            in_time=format_punch_time(
                record.get("in_time", record.get("check_in"))
            ),
            out_time=format_punch_time(
                record.get("out_time", record.get("check_out"))
            ),
            working_hours=format_total_hours(
                record.get("working_hours", record.get("total_hours"))
            ),
        )

    async def _get_matching_roster(
        self,
        attendance_date: date | None,
        department_id: str | None,
        status: str | None,
        search: str | None,
        shift_id: str | None = None,
        overtime_only: bool = False,
        work_location: str | None = None,
        current_user: dict | None = None,
    ) -> list[tuple[dict, dict]]:
        selected_date = attendance_date or business_today()
        date_filter = {"date": to_datetime(selected_date)}

        employee_filters = build_filter({"department_id": department_id})

        # Strip before testing: "   " is truthy in Python and would otherwise
        # filter on a literal-blank value and match no employees.
        location_filter = (work_location or "").strip()

        if location_filter:
            # Anchored and case-insensitive so "kolhapur" matches "Kolhapur"
            # while a stray "." stays a literal instead of a wildcard.
            employee_filters["work_location"] = {
                "$regex": f"^{re.escape(location_filter)}$",
                "$options": "i",
            }

        employees = await self.employee_repository.get_all(
            filters=employee_filters,
            skip=0,
            limit=10000,
            scope=self._created_by_scope(current_user),
        )

        if search:
            search_value = search.lower()
            employees = [
                employee
                for employee in employees
                if search_value in employee.get("first_name", "").lower()
                or search_value in employee.get("last_name", "").lower()
                or search_value in employee.get("employee_id", "").lower()
            ]

        attendance_records = await self.repository.get_all(
            filters={
                **date_filter,
                "employee_id": {
                    "$in": [
                        employee["employee_id"]
                        for employee in employees
                    ]
                    + [str(employee["_id"]) for employee in employees]
                },
            },
            skip=0,
            limit=10000,
        )
        records_by_employee = {
            record["employee_id"]: record for record in attendance_records
        }

        roster: list[tuple[dict, dict]] = []
        for employee in employees:
            employee_id = str(employee["_id"])
            record = records_by_employee.get(employee["employee_id"])
            if record is None:
                # Support attendance documents created before business IDs
                # became the canonical attendance key.
                record = records_by_employee.get(employee_id)

            if record is None:
                record = {
                    "_id": employee["_id"],
                    "employee_id": employee["employee_id"],
                    "department_id": employee.get("department_id", ""),
                    "date": to_datetime(selected_date),
                    "shift": "General",
                    "status": "absent",
                }

            record["status"] = (record.get("status") or "present").lower()

            if status and record["status"] != status.lower():
                continue

            if shift_id and record.get("shift_id") != shift_id:
                continue

            if overtime_only and not record_has_overtime(record):
                continue

            roster.append((record, employee))

        return roster

    async def get_attendance_list(
        self,
        attendance_date: date | None,
        department_id: str | None,
        status: str | None,
        search: str | None,
        pagination: PaginationParams,
        shift_id: str | None = None,
        overtime_only: bool = False,
        work_location: str | None = None,
        current_user: dict | None = None,
    ) -> AttendanceListResponse:
        roster = await self._get_matching_roster(
            attendance_date=attendance_date,
            department_id=department_id,
            status=status,
            search=search,
            shift_id=shift_id,
            overtime_only=overtime_only,
            work_location=work_location,
            current_user=current_user,
        )


        total = len(roster)
        page_roster = roster[pagination.skip : pagination.skip + pagination.limit]
        department_ids = {
            employee.get("department_id") for _, employee in page_roster
        }
        departments = {}
        for current_department_id in department_ids:
            if current_department_id:
                department = await self.department_repository.get_by_id(
                    current_department_id
                )
                if department:
                    departments[current_department_id] = department

        items = [
            self._serialize(
                record,
                employee,
                departments.get(employee.get("department_id")),
            )
            for record, employee in page_roster
        ]

        return AttendanceListResponse(
            items=items,
            total=total,
            page=pagination.page,
            limit=pagination.limit,
        )

    async def get_work_locations(
        self,
        current_user: dict | None = None,
    ) -> list[str]:
        filters = {
            "employee_id": {"$exists": True},
            "work_location": {"$nin": [None, ""]},
            **self._created_by_scope(current_user),
        }

        values = await self.employee_repository.collection.distinct(
            "work_location",
            filters,
        )

        return sorted(
            value
            for value in values
            if isinstance(value, str) and value.strip()
        )

    
    async def get_employee_attendance(
        self,
        employee_id: str,
        pagination: PaginationParams,
        current_user: dict | None = None,
    ) -> list[AttendanceResponse]:
        employee = await self._get_employee(
            employee_id,
            current_user=current_user,
        )

        if not employee:
            raise AppException("Employee not found", 404)

        canonical_employee_id = employee["employee_id"]

        records = await self.repository.get_all(
            filters={"employee_id": canonical_employee_id},
            skip=pagination.skip,
            limit=pagination.limit,
        )

        department = (
            await self.department_repository.get_by_id(
                employee["department_id"]
            )
            if employee.get("department_id")
            else None
        )

        return [
            self._serialize(record, employee, department)
            for record in records
        ]

    async def update_attendance(
        self,
        attendance_id: str,
        update_data: dict,
        current_user: dict | None = None
    ):
        attendance = await self.repository.get_by_id(attendance_id)

        if not attendance:
            raise AppException("Attendance record not found", 404)

        update_data = {
            key: value
            for key, value in update_data.items()
            if value is not None
        }

        employee = await self._get_employee(
            attendance["employee_id"],
            current_user=current_user,
        )

        # A shift change re-derives the duration, which changes overtime.
        shift_changed = any(
            key in update_data
            for key in ("shift_id", "shift", "shift_start", "shift_end")
        )

        if shift_changed:
            shift = await self._resolve_shift(employee, update_data, existing=attendance)

            update_data.update(shift)
        else:
            shift = {
                "shift_id": attendance.get("shift_id"),
                "shift": attendance.get("shift") or "General",
                "shift_start": attendance.get("shift_start"),
                "shift_end": attendance.get("shift_end"),
                "shift_duration_minutes": attendance.get(
                    "shift_duration_minutes"
                ),
            }

        # Fall back to the punch fields: employee-created rows store
        # check_in / check_out and have no in_time / out_time at all. Reading
        # only the admin fields would measure those rows as "no punch" and
        # wipe their worked hours and overtime on every shift edit.
        in_time = update_data.get("in_time") or attendance.get(
            "in_time"
        ) or attendance.get("check_in")
        out_time = update_data.get("out_time") or attendance.get(
            "out_time"
        ) or attendance.get("check_out")

        times_changed = "in_time" in update_data or "out_time" in update_data

        if times_changed or shift_changed:
            metrics = compute_work_metrics(
                in_time,
                out_time,
                shift_duration=shift["shift_duration_minutes"],
                shift_start=shift["shift_start"],
            )

            update_data["working_hours"] = (
                f"{metrics.worked_minutes // 60}H "
                f"{metrics.worked_minutes % 60}M"
                if metrics.worked_minutes is not None
                else None
            )
            update_data["worked_minutes"] = metrics.worked_minutes
            update_data["overtime_minutes"] = metrics.overtime_minutes
            update_data["late_minutes"] = metrics.late_minutes
            update_data["is_overnight"] = metrics.is_overnight

            # Keep total_hours in step. It is what payroll and the employee
            # history read, so leaving a stale value behind would show the old
            # hours next to the corrected ones.
            if metrics.worked_minutes is not None:
                update_data["total_hours"] = round(
                    metrics.worked_minutes / 60,
                    2,
                )

        update_data["is_regularized"] = True
        update_data["updated_at"] = datetime.utcnow()

        updated = await self.repository.update(attendance_id, update_data)

        department = (
            await self.department_repository.get_by_id(updated["department_id"])
            if updated.get("department_id")
            else None
        )

        return self._serialize(updated, employee, department)

    async def get_summary(
        self,
        attendance_date: date,
        department_id: str | None = None,
        current_user: dict | None = None,
    ) -> AttendanceSummaryResponse:
        employees = await self.employee_repository.get_all(
            filters=build_filter({"department_id": department_id}),
            skip=0,
            limit=10000,
            scope=self._created_by_scope(current_user),
        )
        total_employees = len(employees)
        employee_ids = [employee["employee_id"] for employee in employees]

        attendance_ids = employee_ids + [
            str(employee["_id"]) for employee in employees
        ]

        attendance_filters = build_filter({"department_id": department_id})
        attendance_filters["date"] = to_datetime(attendance_date)
        attendance_filters["employee_id"] = {"$in": attendance_ids}

        status_counts = await self.repository.get_status_counts(attendance_filters)

        marked_employee_ids = await self.repository.get_distinct_employee_ids(
            attendance_filters
        )

        # Employees with no record for the date default to "absent".
        unmarked_count = max(total_employees - len(marked_employee_ids), 0)

        present_count = status_counts.get("present", 0)
        late_count = status_counts.get("late", 0)
        on_leave_count = status_counts.get("on_leave", 0)
        missing_punch_count = status_counts.get("missing_punch", 0)
        absent_count = status_counts.get("absent", 0) + unmarked_count

        def pct(count: int) -> float:
            if total_employees == 0:
                return 0.0
            return round((count / total_employees) * 100, 1)

        # Department-wise presence
        present_by_department: dict[str, int] = {}
        attendance_records = await self.repository.get_all(
            filters={
                "date": to_datetime(attendance_date),
                "employee_id": {"$in": employee_ids},
            },
            skip=0,
            limit=10000,
        )
        employees_by_id = {
            employee["employee_id"]: employee for employee in employees
        }
        overtime_employee_count = 0
        overtime_total_minutes = 0

        for record in attendance_records:
            employee = employees_by_id.get(record["employee_id"])
            dept_id = record.get("department_id") or (
                employee.get("department_id") if employee else None
            )
            status = (record.get("status") or "").lower()
            if dept_id and status in PRESENT_LIKE_STATUSES:
                present_by_department[dept_id] = (
                    present_by_department.get(dept_id, 0) + 1
                )

            if record_has_overtime(record):
                overtime_employee_count += 1
                overtime_total_minutes += record_overtime_minutes(record)

        departments = await self.department_repository.get_all(
            filters={},
            skip=0,
            limit=1000,
        ) if hasattr(self.department_repository, "get_all") else []

        department_presence = []
        for department in departments:
            dept_id = str(department["_id"])
            dept_total = sum(
                1
                for employee in employees
                if employee.get("department_id") == dept_id
            )
            dept_present = present_by_department.get(dept_id, 0)

            department_presence.append(
                DepartmentPresence(
                    department_id=dept_id,
                    department_name=department.get("name", "-"),
                    total_employees=dept_total,
                    present_count=dept_present,
                    present_percentage=(
                        round((dept_present / dept_total) * 100, 1)
                        if dept_total
                        else 0.0
                    ),
                )
            )

        return AttendanceSummaryResponse(
            date=attendance_date,
            total_employees=total_employees,
            present_count=present_count,
            present_percentage=pct(present_count),
            late_count=late_count,
            late_percentage=pct(late_count),
            on_leave_count=on_leave_count,
            on_leave_percentage=pct(on_leave_count),
            absent_count=absent_count,
            absent_percentage=pct(absent_count),
            missing_punch_count=missing_punch_count,
            overtime_employee_count=overtime_employee_count,
            overtime_total_minutes=overtime_total_minutes,
            overtime_total_display=format_minutes_compact(
                overtime_total_minutes
            ),
            department_presence=department_presence,
        )

    async def get_overtime_report(
        self,
        start_date: date,
        end_date: date,
        department_id: str | None = None,
        shift_id: str | None = None,
        current_user: dict | None = None,
    ) -> list[dict]:
        """Per-employee overtime totals across a date range.

        Hours only - converting overtime to money is deliberately out of
        scope here and belongs to payroll.
        """
        start = to_datetime(start_date)
        end = to_datetime(end_date)

        employees = await self.employee_repository.get_all(
            filters=build_filter({"department_id": department_id}),
            skip=0,
            limit=10000,
            scope=self._created_by_scope(current_user),
        )

        employee_ids = [employee["employee_id"] for employee in employees]

        if not employee_ids:
            return []

        filters = {
            "date": {"$gte": start, "$lte": end},
            "employee_id": {"$in": employee_ids},
        }

        if shift_id:
            filters["shift_id"] = shift_id

        records = await self.repository.get_all(
            filters=filters,
            skip=0,
            limit=100000,
        )

        totals: dict[str, dict] = {}

        for record in records:
            # Applied in Python rather than as a Mongo filter so that records
            # predating stored overtime minutes are measured the same way the
            # attendance list filter measures them.
            if not record_has_overtime(record):
                continue

            employee_id = record["employee_id"]

            entry = totals.setdefault(
                employee_id,
                {
                    "employee_id": employee_id,
                    "first_name": "",
                    "last_name": "",
                    "department_id": record.get("department_id"),
                    "shift_names": set(),
                    "days_with_overtime": 0,
                    "overtime_minutes": 0,
                },
            )

            minutes = record_overtime_minutes(record)

            if minutes <= 0:
                continue

            entry["days_with_overtime"] += 1
            entry["overtime_minutes"] += minutes

            if record.get("shift"):
                entry["shift_names"].add(record["shift"])

        rows = []

        for employee_id, entry in totals.items():
            employee = next(
                (
                    candidate
                    for candidate in employees
                    if candidate["employee_id"] == employee_id
                ),
                None,
            )

            if employee:
                entry["first_name"] = employee.get("first_name", "")
                entry["last_name"] = employee.get("last_name", "")
                entry["department_id"] = (
                    entry["department_id"] or employee.get("department_id")
                )

            rows.append(
                {
                    "employee_id": entry["employee_id"],
                    "first_name": entry["first_name"],
                    "last_name": entry["last_name"],
                    "department_id": entry["department_id"],
                    "shift_names": sorted(entry["shift_names"]),
                    "days_with_overtime": entry["days_with_overtime"],
                    "overtime_minutes": entry["overtime_minutes"],
                    "overtime_display": format_minutes_compact(
                        entry["overtime_minutes"]
                    ),
                }
            )

        rows.sort(
            key=lambda row: row["overtime_minutes"],
            reverse=True,
        )

        return rows
