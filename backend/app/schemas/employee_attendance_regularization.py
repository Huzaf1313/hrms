from datetime import date, datetime

from pydantic import BaseModel, Field


class AttendanceRegularizationCreate(BaseModel):
    attendance_id: str
    date: date
    issue_type: str

    requested_check_in: datetime | None = None
    requested_check_out: datetime | None = None

    reason: str = Field(..., max_length=300)


class AttendanceRegularizationResponse(BaseModel):
    id: str

    employee_id: str
    # Older/manual records may miss this linkage; it is display-only, so a
    # missing value must not invalidate the whole list.
    attendance_id: str | None = None

    date: date
    issue_type: str

    requested_check_in: datetime | None = None
    requested_check_out: datetime | None = None

    reason: str

    status: str

    requested_at: datetime
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None

    created_at: datetime
    updated_at: datetime
    # Attendance records may store punches as either ISO datetimes or display
    # strings such as "09:30 AM".
    current_check_in: str | datetime | None = None
    current_check_out: str | datetime | None = None
    review_comment: str | None = None

    employee_name: str | None = None
    employee_code: str | None = None
    department_name: str | None = None


class AttendanceRegularizationReview(BaseModel):
    status: str
    comment: str | None = Field(default=None, max_length=300)
