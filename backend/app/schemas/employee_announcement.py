from datetime import datetime
from typing import Any

from pydantic import BaseModel


class EmployeeAnnouncementCreate(BaseModel):
    title: str
    description: str
    category: str
    priority: str = "normal"
    status: str = "published"
    published_at: datetime | None = None
    is_important: bool = False


class EmployeeAnnouncementUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    priority: str | None = None
    status: str | None = None
    published_at: datetime | None = None
    is_important: bool | None = None


class EmployeeAnnouncementResponse(BaseModel):
    id: str
    title: str
    description: str
    category: str
    priority: str
    status: str
    published_at: Any
    created_by: str | None = None
    created_at: Any
    updated_at: Any
    is_important: bool


class EmployeeAnnouncementsResponse(BaseModel):
    announcements: list[EmployeeAnnouncementResponse]
    total: int
    page: int
    page_size: int
    total_pages: int