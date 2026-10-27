from datetime import date

from pydantic import BaseModel, Field


# Allowed values (kept as plain str, same convention as Employee.status):
# "present" | "late" | "absent" | "on_leave" | "working" | "overtime" | "missing_punch"


class AttendanceMark(BaseModel):
    """Admin marks/creates an attendance record for one employee on one date."""

    employee_id: str = Field(min_length=1)
    date: date
    status: str

    # Omitting shift_id lets the employee's own assigned shift apply. Pass a
    # shift_id to override for a single day (e.g. a shift swap).
    shift_id: str | None = None

    # Legacy free-text fields. Still accepted for older clients, but a
    # shift_id is preferred because only a real shift carries a duration and
    # therefore can produce overtime.
    shift: str | None = None
    shift_start: str | None = None
    shift_end: str | None = None

    in_time: str | None = None
    out_time: str | None = None

    notes: str | None = None


class AttendanceUpdate(BaseModel):
    """Admin edits/regularizes an existing attendance record."""

    status: str | None = None

    shift_id: str | None = None
    shift: str | None = None
    shift_start: str | None = None
    shift_end: str | None = None

    in_time: str | None = None
    out_time: str | None = None

    notes: str | None = None


class EmployeeSummary(BaseModel):
    id: str
    employee_code: str
    first_name: str
    last_name: str
    avatar_url: str | None = None
    department_id: str
    department_name: str | None = None


class AttendanceResponse(BaseModel):
    id: str

    employee: EmployeeSummary

    date: date

    # Shift snapshot as it was on the day, so later edits to a shift never
    # rewrite historical attendance.
    shift_id: str | None = None
    shift: str
    shift_start: str | None = None
    shift_end: str | None = None
    shift_duration_minutes: int | None = None

    in_time: str | None = None
    out_time: str | None = None
    working_hours: str | None = None

    # Numeric source of truth. working_hours above is display-only text.
    worked_minutes: int | None = None
    overtime_minutes: int = 0
    overtime_display: str | None = None
    late_minutes: int = 0
    late_display: str | None = None
    is_overtime: bool = False
    is_late: bool = False
    is_overnight: bool = False

    status: str
    is_regularized: bool = False
    notes: str | None = None


class AttendanceListResponse(BaseModel):
    items: list[AttendanceResponse]
    total: int
    page: int
    limit: int


class AttendanceOptionsResponse(BaseModel):
    """Values available for the attendance filter dropdowns."""

    work_locations: list[str]


class StatusCount(BaseModel):
    status: str
    count: int
    percentage: float


class DepartmentPresence(BaseModel):
    department_id: str
    department_name: str
    total_employees: int
    present_count: int
    present_percentage: float


class AttendanceSummaryResponse(BaseModel):
    date: date

    total_employees: int

    present_count: int
    present_percentage: float

    late_count: int
    late_percentage: float

    on_leave_count: int
    on_leave_percentage: float

    absent_count: int
    absent_percentage: float

    missing_punch_count: int

    # Overtime totals for the selected date, summed across all employees.
    overtime_employee_count: int = 0
    overtime_total_minutes: int = 0
    overtime_total_display: str | None = None

    department_presence: list[DepartmentPresence]


class MyAttendanceStatus(BaseModel):
    """Employee self-service: just their own status/in-time/out-time for
    one date. status=None (with everything else blank) means nothing has
    been marked yet for that date - a normal "not clocked in" state, not
    an error."""

    date: date
    status: str | None = None
    in_time: str | None = None
    out_time: str | None = None
    working_hours: str | None = None


class AttendanceTrendDay(BaseModel):
    """One day of the attendance trend."""

    date: date
    present: int = 0
    late: int = 0
    absent: int = 0
    on_leave: int = 0
    missing_punch: int = 0
    total_employees: int = 0


class AttendanceTrendResponse(BaseModel):
    """Daily attendance counts across a date range, for the dashboard chart.

    One request covers the whole range, so the chart does not have to ask for
    a day at a time. `days` stops at today - the days that are still to come
    are not counted, because nobody can be absent for a day that has not
    happened yet.
    """

    start_date: date
    end_date: date
    total_employees: int = 0
    days: list[AttendanceTrendDay] = Field(default_factory=list)


class BulkAttendanceMark(BaseModel):
    """Admin bulk marks/updates attendance records."""

    employee_ids: list[str] = Field(default_factory=list)
    select_all_matching: bool = False
    excluded_employee_ids: list[str] = Field(default_factory=list)

    # Filter parameters if select_all_matching is True
    filter_date: date | None = None
    department_id: str | None = None
    filter_status: str | None = None
    search: str | None = None
    filter_shift_id: str | None = None
    overtime_only: bool = False
    work_location: str | None = None

    # Shared attendance values
    date: date
    status: str
    shift_id: str | None = None
    shift: str | None = None
    shift_start: str | None = None
    shift_end: str | None = None
    in_time: str | None = None
    out_time: str | None = None
    notes: str | None = None


class BulkAttendanceItemResult(BaseModel):
    employee_id: str
    employee_name: str | None = None
    employee_code: str | None = None
    success: bool
    attendance: AttendanceResponse | None = None
    error: str | None = None


class BulkAttendanceResponse(BaseModel):
    total: int
    success_count: int
    failure_count: int
    results: list[BulkAttendanceItemResult]
