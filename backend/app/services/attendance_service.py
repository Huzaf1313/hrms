from datetime import date, datetime

from app.core.exceptions import AppException
from app.repositories.attendance_repository import AttendanceRepository
from app.repositories.department_repository import DepartmentRepository
from app.repositories.employee_repository import EmployeeRepository
from app.schemas.attendance import (
    AttendanceListResponse,
    AttendanceResponse,
    AttendanceSummaryResponse,
    DepartmentPresence,
    EmployeeSummary,
    MyAttendanceStatus,
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


def calculate_working_hours(in_time: str | None, out_time: str | None) -> str | None:
    if not in_time or not out_time:
        return None

    try:
        start = datetime.strptime(in_time, "%I:%M %p")
        end = datetime.strptime(out_time, "%I:%M %p")
    except ValueError:
        return None

    delta = end - start

    if delta.total_seconds() <= 0:
        return None

    hours, remainder = divmod(int(delta.total_seconds()), 3600)
    minutes = remainder // 60

    return f"{hours}h {minutes}m"


def format_punch_time(value) -> str | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.strftime("%I:%M %p")

    return str(value)


def format_total_hours(value) -> str | None:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return f"{value:g}h"

    return str(value)


class AttendanceService:
    def __init__(self):
        self.repository = AttendanceRepository()
        self.employee_repository = EmployeeRepository()
        self.department_repository = DepartmentRepository()

    async def _get_employee(self, employee_id: str):
        employee = await self.employee_repository.get_by_id(employee_id)
        if employee:
            return employee

        return await self.employee_repository.get_by_employee_id(employee_id)

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
        employee_summary = EmployeeSummary(
            id=str(employee["_id"]) if employee else attendance["employee_id"],
            employee_code=employee.get("employee_id", "-") if employee else "-",
            first_name=employee.get("first_name", "Unknown") if employee else "Unknown",
            last_name=employee.get("last_name", "") if employee else "",
            avatar_url=employee.get("avatar_url") if employee else None,
            department_id=attendance.get("department_id", ""),
            department_name=department.get("name") if department else None,
        )

        return AttendanceResponse(
            id=str(attendance["_id"]),
            employee=employee_summary,
            date=attendance["date"].date(),
            shift=attendance.get("shift", "General"),
            shift_start=attendance.get("shift_start"),
            shift_end=attendance.get("shift_end"),
            in_time=format_punch_time(
                attendance.get("in_time") or attendance.get("check_in")
            ),
            out_time=format_punch_time(
                attendance.get("out_time") or attendance.get("check_out")
            ),
            working_hours=format_total_hours(
                attendance.get("working_hours") or attendance.get("total_hours")
            ),
            status=attendance.get("status") or "present",
            is_regularized=attendance.get("is_regularized", False),
            notes=attendance.get("notes"),
        )

    async def mark_attendance(self, data: dict, marked_by: str | None = None):
        employee = await self._get_employee(data["employee_id"])

        if not employee:
            raise AppException("Employee not found", 404)

        attendance_date = to_datetime(data["date"])

        existing = await self.repository.get_by_employee_and_date(
            employee_id=data["employee_id"],
            attendance_date=attendance_date,
        )

        working_hours = calculate_working_hours(
            data.get("in_time"),
            data.get("out_time"),
        )

        record = {
            "employee_id": employee["employee_id"],
            "department_id": employee["department_id"],
            "date": attendance_date,
            "shift": data.get("shift", "General"),
            "shift_start": data.get("shift_start"),
            "shift_end": data.get("shift_end"),
            "in_time": data.get("in_time"),
            "out_time": data.get("out_time"),
            "working_hours": working_hours,
            "status": data["status"],
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

        department = await self.department_repository.get_by_id(
            employee["department_id"]
        )

        return self._serialize(attendance, employee, department)

    async def get_attendance(self, attendance_id: str):
        attendance = await self.repository.get_by_id(attendance_id)

        if not attendance:
            raise AppException("Attendance record not found", 404)

        employee = await self._get_employee(attendance["employee_id"])
        department = (
            await self.department_repository.get_by_id(attendance["department_id"])
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

    async def get_attendance_list(
        self,
        attendance_date: date | None,
        department_id: str | None,
        status: str | None,
        search: str | None,
        pagination: PaginationParams,
    ) -> AttendanceListResponse:
        selected_date = attendance_date or date.today()
        date_filter = {"date": to_datetime(selected_date)}
        employees = await self.employee_repository.get_all(
            filters=build_filter({"department_id": department_id}),
            skip=0,
            limit=1000,
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
            filters=date_filter,
            skip=0,
            limit=1000,
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

            record["status"] = record.get("status") or "present"

            if status and record["status"] != status:
                continue

            roster.append((record, employee))

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

    async def update_attendance(
        self,
        attendance_id: str,
        update_data: dict,
    ):
        attendance = await self.repository.get_by_id(attendance_id)

        if not attendance:
            raise AppException("Attendance record not found", 404)

        update_data = {
            key: value
            for key, value in update_data.items()
            if value is not None
        }

        in_time = update_data.get("in_time", attendance.get("in_time"))
        out_time = update_data.get("out_time", attendance.get("out_time"))

        if "in_time" in update_data or "out_time" in update_data:
            update_data["working_hours"] = calculate_working_hours(in_time, out_time)

        update_data["is_regularized"] = True
        update_data["updated_at"] = datetime.utcnow()

        updated = await self.repository.update(attendance_id, update_data)

        employee = await self._get_employee(updated["employee_id"])
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
    ) -> AttendanceSummaryResponse:
        employees = await self.employee_repository.get_all(
            filters=build_filter({"department_id": department_id}),
            skip=0,
            limit=10000,
        )
        employee_ids = [employee["employee_id"] for employee in employees]

        employee_filters = {
            "employee_id": {"$exists": True},
            **build_filter({"department_id": department_id}),
        }
        total_employees = await self.employee_repository.collection.count_documents(
            employee_filters
        )

        attendance_filters = build_filter({"department_id": department_id})
        attendance_filters["date"] = to_datetime(attendance_date)
        attendance_filters["employee_id"] = {"$in": employee_ids}

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

        departments = await self.department_repository.get_all(
            filters={},
            skip=0,
            limit=1000,
        ) if hasattr(self.department_repository, "get_all") else []

        department_presence = []
        for department in departments:
            dept_id = str(department["_id"])
            dept_total = await self.employee_repository.collection.count_documents(
                {
                    "department_id": dept_id,
                    "employee_id": {"$exists": True},
                }
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
            department_presence=department_presence,
        )