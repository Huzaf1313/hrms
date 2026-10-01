from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field


class AnnouncementCategory(str, Enum):
    COMPANY_NEWS = "Company News"
    HR_POLICY = "HR & Policy"
    EVENTS = "Events"
    IT_SYSTEM = "IT & System"


class AnnouncementPriority(str, Enum):
    NORMAL = "Normal"
    IMPORTANT = "Important"
    URGENT = "Urgent"


class AnnouncementAudience(str, Enum):
    ALL_EMPLOYEES = "All Employees"
    DEPARTMENT_WISE = "Department-wise"
    CUSTOM = "Custom"


class AttachmentInfo(BaseModel):
    filename: str
    url: str
    content_type: str | None = None
    size: int | None = None


class EmployeeAnnouncementResponse(BaseModel):
    id: str
    title: str
    description: str
    category: AnnouncementCategory
    priority: AnnouncementPriority
    audience: AnnouncementAudience
    publish_date: date
    expiry_date: date | None = None
    pinned: bool
    author_name: str
    attachment: AttachmentInfo | None = None
    created_at: datetime


class EmployeeAnnouncementsResponse(BaseModel):
    announcements: list[EmployeeAnnouncementResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
