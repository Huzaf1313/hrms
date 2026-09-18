from datetime import datetime, timezone
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
        announcement["id"] = str(announcement.pop("_id"))
        return announcement

    async def create(
        self,
        data: dict[str, Any],
        created_by: str | None = None,
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)

        announcement = {
            **data,
            "created_by": created_by,
            "created_at": now,
            "updated_at": now,
        }

        if announcement.get("published_at") is None:
            announcement["published_at"] = now

        created = await self.repository.create(announcement)

        return self._serialize(created)

    async def get_by_id(
        self,
        announcement_id: str,
    ) -> dict[str, Any] | None:
        announcement = await self.repository.get_by_id(announcement_id)

        if not announcement:
            return None

        return self._serialize(announcement)

    async def update(
        self,
        announcement_id: str,
        data: dict[str, Any],
    ) -> dict[str, Any] | None:
        update_data = {
            key: value
            for key, value in data.items()
            if value is not None
        }

        update_data["updated_at"] = datetime.now(timezone.utc)

        updated = await self.repository.update(
            announcement_id,
            update_data,
        )

        if not updated:
            return None

        return self._serialize(updated)

    async def delete(
        self,
        announcement_id: str,
    ) -> bool:
        return await self.repository.delete(announcement_id)

    async def get_published(
        self,
        page: int = 1,
        page_size: int = 10,
        category: str | None = None,
        search: str | None = None,
    ) -> dict[str, Any]:
        page = max(page, 1)
        page_size = max(min(page_size, 100), 1)

        skip = (page - 1) * page_size

        announcements, total = await self.repository.get_published(
            skip=skip,
            limit=page_size,
            category=category,
            search=search,
        )

        serialized = [
            self._serialize(announcement)
            for announcement in announcements
        ]

        total_pages = ceil(total / page_size) if total else 0

        return {
            "announcements": serialized,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }