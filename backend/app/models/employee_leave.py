from datetime import date, datetime

from pydantic import BaseModel, Field


class EmployeeLeaveModel(BaseModel):
    id: str | None = None

    employee_id: str

    leave_type: str

    start_date: date

    end_date: date

    total_days: int

    reason: str = Field(..., max_length=300)

    attachment_url: str | None = None

    status: str = "Pending"

    requested_at: datetime = Field(
        default_factory=datetime.utcnow
    )

    reviewed_at: datetime | None = None

    reviewed_by: str | None = None

    admin_note: str | None = None

    created_at: datetime = Field(
        default_factory=datetime.utcnow
    )

    updated_at: datetime = Field(
        default_factory=datetime.utcnow
    )