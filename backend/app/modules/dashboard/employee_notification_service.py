from typing import Any
from app.repositories.employee_notification_repository import (
    EmployeeNotificationRepository,
)


class EmployeeNotificationService :
    def __init__(self):
        self.repository = EmployeeNotificationRepository()

    @staticmethod
    def _serialize(notification: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": str(notification["_id"]),
            "employee_id": notification.get("employee_id", ""),
            "type": notification.get("type", ""),
            "title": notification.get("title", ""),
            "message": notification.get("message", ""),
            "target": notification.get("target"),
            "target_id": (
                str(notification["target_id"])
                if notification.get("target_id") is not None
                else None
            ),
            "is_read": notification.get("is_read", False),
            "created_at": notification.get("created_at"),
            "read_at": notification.get("read_at"),
        }

    async def create(
        self,
        employee_id: str,
        notification_type: str,
        title: str,
        message: str,
        target: str | None = None,
        target_id: str | None = None,
    ):
        notification = {
            "employee_id": employee_id,
            "type": notification_type,
            "title": title,
            "message": message,
            "target": target,
            "target_id": target_id,
            "is_read": False,
            "read_at": None,
        }

        result = await self.repository.create(notification)

        return self._serialize(result)

    async def create_many(
        self,
        notifications: list[dict],
    ):
        if not notifications:
            return []

        results = await self.repository.create_many(notifications)

        return [
            self._serialize(notification)
            for notification in results
        ]

    async def get_for_employee(
        self,
        employee_id: str,
        skip: int = 0,
        limit: int = 20,
    ):
        notifications = await self.repository.get_by_employee(
            employee_id=employee_id,
            skip=skip,
            limit=limit,
        )

        unread_count = await self.repository.count_unread(
            employee_id
        )

        return {
            "notifications": [
                self._serialize(notification)
                for notification in notifications
            ],
            "unread_count": unread_count,
        }

    async def get_unread_count(
        self,
        employee_id: str,
    ):
        return await self.repository.count_unread(
            employee_id
        )

    async def mark_as_read(
        self,
        notification_id: str,
        employee_id: str,
    ):
        notification = await self.repository.mark_as_read(
            notification_id=notification_id,
            employee_id=employee_id,
        )

        if not notification:
            return None

        return self._serialize(notification)

    async def mark_all_as_read(
        self,
        employee_id: str,
    ):
        return await self.repository.mark_all_as_read(
            employee_id
        )