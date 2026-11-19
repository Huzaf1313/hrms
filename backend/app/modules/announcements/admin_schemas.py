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


class AdminAnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    category: AnnouncementCategory
    priority: AnnouncementPriority = AnnouncementPriority.NORMAL
    publish_date: date
    expiry_date: date | None = None
    audience: AnnouncementAudience = AnnouncementAudience.ALL_EMPLOYEES
    description: str = Field(min_length=1, max_length=5000)
    pinned: bool = False
    target_departments: list[str] = Field(default_factory=list)
    target_employees: list[str] = Field(default_factory=list)


class AdminAnnouncementUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=100)
    category: AnnouncementCategory | None = None
    priority: AnnouncementPriority | None = None
    publish_date: date | None = None
    expiry_date: date | None = None
    audience: AnnouncementAudience | None = None
    description: str | None = Field(default=None, max_length=5000)
    pinned: bool | None = None
    target_departments: list[str] | None = None
    target_employees: list[str] | None = None


class AdminAnnouncementResponse(BaseModel):
    id: str
    title: str
    category: AnnouncementCategory
    priority: AnnouncementPriority
    publish_date: date
    expiry_date: date | None = None
    audience: AnnouncementAudience
    description: str
    pinned: bool
    target_departments: list[str] = Field(default_factory=list)
    target_employees: list[str] = Field(default_factory=list)
    attachment: AttachmentInfo | None = None
    author_id: str
    author_name: str
    created_at: datetime
    updated_at: datetime