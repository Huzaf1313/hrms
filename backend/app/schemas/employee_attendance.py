from datetime import date, datetime

from pydantic import BaseModel


class AttendanceCreate(BaseModel):
    employee_id: str
    date: date
    check_in: datetime | None = None
    check_out: datetime | None = None
    status: str
    total_hours: float | None = None
    remarks: str | None = None


class AttendanceUpdate(BaseModel):
    check_in: datetime | None = None
    check_out: datetime | None = None
    status: str | None = None
    total_hours: float | None = None
    remarks: str | None = None


class AttendanceResponse(BaseModel):
    id: str
    employee_id: str
    date: date
    check_in: datetime | None = None
    check_out: datetime | None = None
    status: str
    total_hours: float | None = None
    remarks: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AttendanceHistoryResponse(BaseModel):
    records: list[AttendanceResponse]
    total: int