from datetime import date, datetime
from typing import Literal
 
from pydantic import BaseModel, Field
 
NoticePeriod = Literal[15, 30, 60, 90]

# Every way an employee can leave. The employee-facing form only ever raises a
# Resignation; the remaining types are recorded by HR from the admin side.
ExitType = Literal["Resignation", "Termination", "Contract End", "Retirement"]

# Drives the tab order, the KPI row and the donut slices so all three report
# the same four buckets even when a type has no requests yet.
EXIT_TYPE_ORDER: list[str] = [
    "Resignation",
    "Termination",
    "Contract End",
    "Retirement",
]

ResignationReason = Literal[
    "Better Opportunity",
    "Higher Studies",
    "Career Change",
    "Relocation",
    "Health Reasons",
    "Personal Reasons",
    "Work-Life Balance",
    "Other",
]
 
HandoverStatus = Literal["Pending", "In Progress", "Completed"]
 
 
class HandoverTask(BaseModel):
    task: str = Field(min_length=1, max_length=100)
    remarks: str | None = Field(default=None, max_length=300)
    status: HandoverStatus = "Pending"
    is_checked: bool = False
 
 
class ExitRequestCreate(BaseModel):
    last_working_day: date
    notice_period_days: NoticePeriod
    reason: ResignationReason
    remarks: str | None = Field(default=None, max_length=500)
    handover_tasks: list[HandoverTask] = Field(default_factory=list, max_length=10)
    confirmed: bool
 
 
class ExitStatusUpdate(BaseModel):
    # Validated in the service so the client gets a readable message.
    status: str
    admin_note: str | None = Field(default=None, max_length=500)


class AdminExitRequestCreate(BaseModel):
    """HR recording a departure the employee did not raise themselves.

    Covers the types the employee form cannot produce (Termination, Contract
    End, Retirement), plus resignation raised on someone's behalf.
    """

    employee_id: str
    exit_type: ExitType
    last_working_day: date
    reason: str = Field(min_length=1, max_length=200)
    remarks: str | None = Field(default=None, max_length=500)
    notice_period_days: int = Field(default=30, ge=0, le=180)
    handover_tasks: list[HandoverTask] = Field(default_factory=list, max_length=10)
 
 
class ExitAttachmentResponse(BaseModel):
    id: str
    file_name: str
    file_size: int
    mime_type: str
    uploaded_at: datetime
 
 
class ExitRequestResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str | None = None
    email: str | None = None
    designation: str | None = None
    department_id: str | None = None
    department_name: str | None = None
    reporting_manager: str | None = None
    exit_type: str
    last_working_day: date
    notice_period_days: int
    reason: str
    remarks: str | None = None
    handover_tasks: list[HandoverTask] = []
    attachments: list[ExitAttachmentResponse] = []
    status: str
    submitted_at: datetime
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None
    admin_note: str | None = None
    created_at: datetime
    updated_at: datetime
 
 
class ExitRequestListResponse(BaseModel):
    items: list[ExitRequestResponse]
    total: int
    page: int
    limit: int
    pages: int
 
 
class DepartmentExitCount(BaseModel):
    department_id: str | None = None
    department_name: str
    count: int


class ExitRequestSummary(BaseModel):
    total: int = 0
    pending: int = 0
    in_progress: int = 0
    completed: int = 0
    rejected: int = 0
    cancelled: int = 0
    # Every type is reported, including zeroes, so the KPI row and the donut
    # keep a stable set of cards instead of losing one when a type is unused.
    by_type: dict[str, int] = {}
    by_department: list[DepartmentExitCount] = []