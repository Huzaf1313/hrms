from datetime import datetime

from pydantic import BaseModel, Field


class AttendanceModel(BaseModel):
    id: str | None = None
    employee_id: str
    user_id: str
    date: str
    check_in: datetime | None = None
    check_out: datetime | None = None
    status: str = "present"
    total_hours: float | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)