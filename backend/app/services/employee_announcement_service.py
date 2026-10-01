from datetime import date
from math import ceil
from typing import Any

from app.repositories.employee_announcement_repository import (
    EmployeeAnnouncementRepository,
)


class EmployeeAnnouncementService:
    def __init__(self):
        self.repository = EmployeeAnnouncementRepository()

    @staticmethod
    def _serialize(announcement: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": str(announcement["_id"]),
            "title": announcement.get("title", ""),
            "description": announcement.get("description", ""),
            "category": announcement.get("category"),
            "priority": announcement.get("priority", "Normal"),
            "audience": announcement.get("audience", "All Employees"),
            "publish_date": announcement.get("publish_date"),
            "expiry_date": announcement.get("expiry_date"),
            "pinned": announcement.get("pinned", False),
            "author_name": announcement.get("author_name", "HR Team"),
            "attachment": announcement.get("attachment"),
            "created_at": announcement.get("created_at"),
        }

    async def get_by_id(
        self,
        announcement_id: str,
        user_id: str | None,
        department_id: str | None,
    ) -> dict[str, Any] | None:
        announcement = await self.repository.get_by_id(
            announcement_id,
            user_id=user_id,
            department_id=department_id,
        )

        if not announcement:
            return None

        return self._serialize(announcement)

    async def get_visible(
        self,
        user_id: str | None,
        department_id: str | None,
        page: int = 1,
        page_size: int = 10,
        category: str | None = None,
        search: str | None = None,
        pinned: bool | None = None,
    ) -> dict[str, Any]:
        page = max(page, 1)
        page_size = max(min(page_size, 100), 1)

        skip = (page - 1) * page_size

        announcements, total = await self.repository.get_visible(
            user_id=user_id,
            department_id=department_id,
            skip=skip,
            limit=page_size,
            category=category,
            search=search,
            pinned=pinned,
        )

        return {
            "announcements": [
                self._serialize(announcement)
                for announcement in announcements
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": ceil(total / page_size) if total else 0,
        }
