from datetime import date, datetime

from pydantic import BaseModel, Field


class LeaveCreate(BaseModel):
    employee_id: str = Field(min_length=1)
    leave_type: str = Field(min_length=1)
    start_date: date
    end_date: date
    reason: str | None = None


class LeaveStatusUpdate(BaseModel):
    status: str = Field(
        pattern="^(pending|approved|rejected|cancelled)$"
    )
    admin_note: str | None = None


class LeaveResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str | None = None
    department_id: str | None = None
    department_name: str | None = None
    leave_type: str
    start_date: date
    end_date: date
    total_days: int | None = None
    reason: str | None = None
    status: str
    created_at: datetime
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None
    admin_note: str | None = None


class LeaveBalanceEntry(BaseModel):
    leave_type: str = Field(min_length=1)
    used: int = Field(ge=0)
    total: int = Field(ge=0)


class LeaveBalanceUpdate(BaseModel):
    balances: list[LeaveBalanceEntry] = Field(min_length=1)


class LeaveTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    allocated_days: int = Field(ge=0)


class LeaveTypeUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    allocated_days: int = Field(ge=0)


class LeaveSummaryResponse(BaseModel):
    total_leave_requests: int
    pending_requests: int
    approved_requests: int
    rejected_requests: int
    on_leave_today: int
    upcoming_leaves: int
