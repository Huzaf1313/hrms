from datetime import datetime

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    id: str
    employee_id: str
    type: str
    title: str
    message: str
    target: str | None = None
    target_id: str | None = None
    is_read: bool
    created_at: datetime
    read_at: datetime | None = None


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    unread_count: int