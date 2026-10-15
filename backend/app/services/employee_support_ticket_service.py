from datetime import datetime, timezone
from math import ceil
from typing import Any

from app.repositories.employee_support_ticket_repository import (
    EmployeeSupportTicketRepository,
)
from app.schemas.employee_support_ticket import (
    SupportTicketCreate,
    SupportTicketPriority,
    SupportTicketStatus,
)
from app.services.admin_notification_service import AdminNotificationService
from app.services.employee_notification_service import (
    EmployeeNotificationService,
)


class EmployeeSupportTicketService:
    def __init__(self):
        self.repository = EmployeeSupportTicketRepository()
        self.admin_notification_service = AdminNotificationService()
        # Employee-facing side: used to tell an employee their ticket moved.
        self.notification_service = EmployeeNotificationService()

    @staticmethod
    def _serialize(ticket: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": str(ticket["_id"]),
            "subject": ticket.get("subject", ""),
            "category": ticket.get("category"),
            "priority": ticket.get("priority"),
            "description": ticket.get("description", ""),
            "status": ticket.get(
                "status",
                SupportTicketStatus.OPEN.value,
            ),
            "employee_id": ticket.get("employee_id", ""),
            "created_at": ticket["created_at"],
            "updated_at": ticket["updated_at"],
            "resolution_note": ticket.get("resolution_note"),
            "handled_by": ticket.get("handled_by"),
            "handled_at": ticket.get("handled_at"),
        }

    async def create_ticket(
        self,
        data: SupportTicketCreate,
        employee_id: str,
    ) -> dict[str, Any]:
        ticket_data = data.model_dump(mode="json")

        ticket_data.update(
            {
                "employee_id": employee_id,
                "status": SupportTicketStatus.OPEN.value,
            }
        )

        ticket = await self.repository.create(ticket_data)

        # Routed to the admin who onboarded this employee. Wrapped so a
        # notification failure can never lose the ticket itself.
        try:
            await self.admin_notification_service.create_for_employee(
                employee_id=employee_id,
                notification_type="support_ticket_raised",
                title=f"{data.priority} support ticket",
                message=f"{data.category}: {data.subject}",
                target="/dashboard/support-tickets",
                target_id=str(ticket.get("_id")),
            )
        except Exception:
            pass

        return self._serialize(ticket)

    async def get_ticket(
        self,
        ticket_id: str,
        employee_id: str,
    ) -> dict[str, Any] | None:
        ticket = await self.repository.get_by_id(
            ticket_id=ticket_id,
            employee_id=employee_id,
        )

        if not ticket:
            return None

        return self._serialize(ticket)

    async def get_my_tickets(
        self,
        employee_id: str,
        page: int = 1,
        page_size: int = 10,
    ) -> dict[str, Any]:
        page = max(page, 1)
        page_size = max(min(page_size, 100), 1)

        skip = (page - 1) * page_size

        tickets, total = await self.repository.get_by_employee(
            employee_id=employee_id,
            skip=skip,
            limit=page_size,
        )

        return {
            "tickets": [
                self._serialize(ticket)
                for ticket in tickets
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": ceil(total / page_size) if total else 0,
        }

    async def list_all_tickets(
        self,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
        category: str | None = None,
        priority: str | None = None,
        search: str | None = None,
    ) -> dict[str, Any]:
        """Every ticket across the organization, for the admin queue."""
        page = max(page, 1)
        page_size = max(min(page_size, 100), 1)

        skip = (page - 1) * page_size

        tickets, total = await self.repository.list_all(
            status=status,
            category=category,
            priority=priority,
            search=search,
            skip=skip,
            limit=page_size,
        )

        return {
            "tickets": [self._serialize(ticket) for ticket in tickets],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": ceil(total / page_size) if total else 0,
        }

    # Anything not yet answered counts against the team.
    OPEN_STATUSES = [
        SupportTicketStatus.OPEN.value,
        SupportTicketStatus.IN_PROGRESS.value,
        SupportTicketStatus.WAITING_FOR_EMPLOYEE.value,
    ]

    HIGH_PRIORITIES = [
        SupportTicketPriority.HIGH.value,
        SupportTicketPriority.URGENT.value,
    ]

    async def get_dashboard_analytics(self) -> dict[str, Any]:
        """KPI row, breakdowns and aging for the admin support dashboard."""
        return await self.repository.get_analytics(
            open_statuses=self.OPEN_STATUSES,
            high_priorities=self.HIGH_PRIORITIES,
        )

    async def get_ticket_as_admin(self, ticket_id: str):
        ticket = await self.repository.get_by_id_any_owner(ticket_id)

        if not ticket:
            return None

        return self._serialize(ticket)

    async def respond_to_ticket(
        self,
        ticket_id: str,
        status: str,
        resolution_note: str | None,
        handled_by: str,
    ) -> dict[str, Any] | None:
        update_data: dict[str, Any] = {
            "status": status,
            "handled_by": handled_by,
        }

        if resolution_note is not None:
            update_data["resolution_note"] = resolution_note.strip() or None

        if status in (
            SupportTicketStatus.RESOLVED.value,
            SupportTicketStatus.CLOSED.value,
        ):
            update_data["handled_at"] = datetime.now(timezone.utc)

        ticket = await self.repository.update_ticket(
            ticket_id,
            update_data,
        )

        if not ticket:
            return None

        # Tell the employee how their ticket was handled. Wrapped so a failure
        # here cannot lose the admin's reply.
        try:
            await self.notification_service.create(
                employee_id=str(ticket.get("employee_id", "")),
                notification_type=f"support_ticket_{status.lower().replace(' ', '_')}",
                title=f"Support ticket {status.lower()}",
                message=(
                    resolution_note
                    or f'Your ticket "{ticket.get("subject", "")}" is now {status}.'
                ),
                target="/employee/help-support",
                target_id=str(ticket["_id"]),
            )
        except Exception:
            pass

        return self._serialize(ticket)