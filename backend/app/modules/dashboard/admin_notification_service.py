from typing import Any

from app.core.roles import ADMIN_ROLES
from app.repositories.employee_notification_repository import (
    EmployeeNotificationRepository,
)
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.user_repository import UserRepository


class AdminNotificationService:
    """In-app notifications for admins about their own employees' requests.

    Reuses the employee `notifications` collection and its
    (employee_id, created_at) index rather than introducing a parallel store.
    Admin accounts have no `employee_id` of their own, so they are addressed by a
    namespaced key instead: "admin:<user id>". An employee code can never look
    like that, so the two address spaces cannot collide.
    """

    PREFIX = "admin:"

    def __init__(self):
        self.repository = EmployeeNotificationRepository()
        self.employee_repository = EmployeeRepository()
        self.user_repository = UserRepository()

    @classmethod
    def recipient_key(cls, user_id: str) -> str:
        return f"{cls.PREFIX}{user_id}"

    @classmethod
    def _serialize(cls, notification: dict[str, Any]) -> dict[str, Any]:
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

    async def _load_employee(self, employee_id: str) -> dict | None:
        employee = await self.employee_repository.get_by_employee_id(
            employee_id
        )

        if not employee:
            employee = await self.employee_repository.get_by_id(employee_id)

        return employee

    @staticmethod
    def display_name(employee: dict | None, fallback: str) -> str:
        if not employee:
            return fallback

        return (
            employee.get("full_name")
            or " ".join(
                part
                for part in (
                    employee.get("first_name"),
                    employee.get("last_name"),
                )
                if part
            ).strip()
            or fallback
        )

    async def resolve_recipients(self, employee_id: str) -> list[str]:
        """Which admin user ids should hear about this employee's request."""
        return await self._recipients_for(
            await self._load_employee(employee_id)
        )

    async def _recipients_for(self, employee: dict | None) -> list[str]:
        """Prefers the admin who created the employee's profile, so each HR
        member sees the requests belonging to the people they onboarded. Falls
        back to every active admin when that creator is unknown (records
        predating `created_by`) or is no longer an active admin.
        """
        owner = employee.get("created_by") if employee else None

        if owner:
            creator = await self.user_repository.get_by_id(str(owner))

            # ADMIN_ROLES includes the super admin, so an employee it onboarded
            # notifies it alone. The fallback below (get_admin_accounts) only
            # covers HR and managers.
            if (
                creator
                and creator.get("is_active")
                and not creator.get("is_locked")
                and creator.get("role") in ADMIN_ROLES
            ):
                return [str(creator["_id"])]

        admins = await self.user_repository.get_admin_accounts()

        return [str(admin["_id"]) for admin in admins]

    async def create_for_employee(
        self,
        employee_id: str,
        notification_type: str,
        title: str,
        message: str,
        target: str | None = None,
        target_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Fan one notification out to every admin responsible for this employee."""
        employee = await self._load_employee(employee_id)

        recipients = await self._recipients_for(employee)
        print("ADMIN NOTIFICATION DEBUG")
        print("Employee ID:", employee_id)
        print("Employee found:", employee is not None)
        print("Created by:", employee.get("created_by") if employee else None)
        print("Resolved admin recipients:", recipients)         
        if not recipients:
            return []

        who = self.display_name(employee, employee_id)

        documents = [
            {
                "employee_id": self.recipient_key(user_id),
                "type": notification_type,
                "title": f"{title} - {who}",
                "message": message,
                "target": target,
                "target_id": target_id,
                "is_read": False,
                "read_at": None,
            }
            for user_id in recipients
        ]

        created = await self.repository.create_many(documents)
        print("Notifications created:", len(created))
        return [self._serialize(item) for item in created]

    async def get_for_admin(
        self,
        admin_user_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> dict[str, Any]:
        key = self.recipient_key(admin_user_id)

        notifications = await self.repository.get_by_employee(
            employee_id=key,
            skip=skip,
            limit=limit,
        )

        unread_count = await self.repository.count_unread(key)

        return {
            "notifications": [
                self._serialize(notification)
                for notification in notifications
            ],
            "total": len(notifications),
            "unread_count": unread_count,
        }

    async def get_unread_count(self, admin_user_id: str) -> int:
        return await self.repository.count_unread(
            self.recipient_key(admin_user_id)
        )

    async def mark_as_read(
        self,
        notification_id: str,
        admin_user_id: str,
    ) -> dict[str, Any] | None:
        notification = await self.repository.mark_as_read(
            notification_id=notification_id,
            employee_id=self.recipient_key(admin_user_id),
        )

        if not notification:
            return None

        return self._serialize(notification)

    async def mark_all_as_read(self, admin_user_id: str) -> int:
        return await self.repository.mark_all_as_read(
            self.recipient_key(admin_user_id)
        )