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
    attendance_id: str

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


class AttendanceRegularizationReview(BaseModel):
    status: str
