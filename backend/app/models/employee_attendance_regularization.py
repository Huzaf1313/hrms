from datetime import datetime

from pydantic import BaseModel, Field


class AttendanceRegularizationModel(BaseModel):
    id: str | None = None

    employee_id: str
    attendance_id: str

    date: str

    issue_type: str

    requested_check_in: datetime | None = None
    requested_check_out: datetime | None = None

    reason: str

    status: str = "Pending"

    requested_at: datetime = Field(
        default_factory=datetime.utcnow
    )

    reviewed_at: datetime | None = None
    reviewed_by: str | None = None

    created_at: datetime = Field(
        default_factory=datetime.utcnow
    )

    updated_at: datetime = Field(
        default_factory=datetime.utcnow
    )