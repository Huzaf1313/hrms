from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

NoticePeriod = Literal[15, 30, 60, 90]

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


class ExitAttachmentResponse(BaseModel):
    id: str
    file_name: str
    file_size: int
    mime_type: str
    uploaded_at: datetime


class ExitDocumentResponse(BaseModel):
    key: str
    label: str
    required: bool = True
    status: str  # "Pending" | "Submitted"
    file_name: str | None = None
    file_size: int | None = None
    uploaded_at: datetime | None = None


class ExitRequestResponse(BaseModel):
    id: str
    request_number: str | None = None
    employee_id: str
    employee_name: str | None = None
    email: str | None = None
    designation: str | None = None
    department_id: str | None = None
    reporting_manager: str | None = None
    exit_type: str
    last_working_day: date
    notice_period_days: int
    reason: str
    remarks: str | None = None
    handover_tasks: list[HandoverTask] = []
    attachments: list[ExitAttachmentResponse] = []
    documents: list[ExitDocumentResponse] = []
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


class ExitRequestSummary(BaseModel):
    total: int = 0
    pending: int = 0
    in_progress: int = 0
    completed: int = 0
    rejected: int = 0
    cancelled: int = 0