from datetime import date, datetime

from pydantic import BaseModel, Field


class EmployeeLeaveCreate(BaseModel):
    leave_type: str = Field(
        min_length=1
    )

    start_date: date

    end_date: date

    reason: str = Field(
        ...,
        max_length=300
    )

    attachment_url: str | None = None


class EmployeeLeaveResponse(BaseModel):
    id: str

    employee_id: str

    leave_type: str

    start_date: date

    end_date: date

    total_days: int

    reason: str

    attachment_url: str | None = None

    status: str

    requested_at: datetime

    reviewed_at: datetime | None = None

    reviewed_by: str | None = None

    admin_note: str | None = None

    created_at: datetime

    updated_at: datetime