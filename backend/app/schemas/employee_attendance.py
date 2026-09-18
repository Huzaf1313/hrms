from datetime import date, datetime, timezone

from pydantic import BaseModel, field_validator


def normalize_datetime_to_utc(
    value: datetime | None,
) -> datetime | None:
    if value is None:
        return None

    # If the incoming datetime has no timezone information,
    # treat it as UTC rather than local server time.
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    # Convert timezone-aware values to UTC.
    return value.astimezone(timezone.utc)


class AttendanceCreate(BaseModel):
    employee_id: str
    date: date
    check_in: datetime | None = None
    check_out: datetime | None = None
    status: str
    total_hours: float | None = None
    remarks: str | None = None

    @field_validator("check_in", "check_out")
    @classmethod
    def normalize_timestamps(
        cls,
        value: datetime | None,
    ) -> datetime | None:
        return normalize_datetime_to_utc(value)


class AttendanceUpdate(BaseModel):
    check_in: datetime | None = None
    check_out: datetime | None = None
    status: str | None = None
    total_hours: float | None = None
    remarks: str | None = None

    @field_validator("check_in", "check_out")
    @classmethod
    def normalize_timestamps(
        cls,
        value: datetime | None,
    ) -> datetime | None:
        return normalize_datetime_to_utc(value)


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