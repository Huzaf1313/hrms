from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class SupportTicketCategory(str, Enum):
    IT = "IT"
    HR = "HR"
    PAYROLL = "Payroll"
    ATTENDANCE = "Attendance"
    LEAVE = "Leave"
    OTHER = "Other"


class SupportTicketPriority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    URGENT = "Urgent"


class SupportTicketStatus(str, Enum):
    OPEN = "Open"
    IN_PROGRESS = "In Progress"
    WAITING_FOR_EMPLOYEE = "Waiting for Employee"
    RESOLVED = "Resolved"
    CLOSED = "Closed"


class SupportTicketCreate(BaseModel):
    subject: str = Field(min_length=5, max_length=150)
    category: SupportTicketCategory
    priority: SupportTicketPriority
    description: str = Field(min_length=10, max_length=5000)


class SupportTicketResponse(BaseModel):
    id: str
    subject: str
    category: SupportTicketCategory
    priority: SupportTicketPriority
    description: str
    status: SupportTicketStatus
    employee_id: str
    created_at: datetime
    updated_at: datetime

    # Admin-side extras. Null on a ticket that has not been answered yet.
    resolution_note: str | None = None
    handled_by: str | None = None
    handled_at: datetime | None = None


class SupportTicketUpdate(BaseModel):
    """Admin response to a ticket. Status is always required so a ticket cannot
    be left in a half-answered state."""

    status: SupportTicketStatus
    resolution_note: str | None = Field(default=None, max_length=2000)


class SupportTicketsResponse(BaseModel):
    tickets: list[SupportTicketResponse]
    total: int
    page: int
    page_size: int
    total_pages: int