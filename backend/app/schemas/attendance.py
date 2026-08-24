from datetime import date

from pydantic import BaseModel, Field


# Allowed values (kept as plain str, same convention as Employee.status):
# "present" | "late" | "absent" | "on_leave" | "working" | "overtime" | "missing_punch"


class AttendanceMark(BaseModel):
    """Admin marks/creates an attendance record for one employee on one date."""

    employee_id: str = Field(min_length=1)
    date: date
    status: str

    shift: str = "General"
    shift_start: str | None = "09:30 AM"
    shift_end: str | None = "06:30 PM"

    in_time: str | None = None
    out_time: str | None = None

    notes: str | None = None


class AttendanceUpdate(BaseModel):
    """Admin edits/regularizes an existing attendance record."""

    status: str | None = None
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
    shift: str
    shift_start: str | None = None
    shift_end: str | None = None

    in_time: str | None = None
    out_time: str | None = None
    working_hours: str | None = None

    status: str
    is_regularized: bool = False
    notes: str | None = None


class AttendanceListResponse(BaseModel):
    items: list[AttendanceResponse]
    total: int
    page: int
    limit: int


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

    department_presence: list[DepartmentPresence]