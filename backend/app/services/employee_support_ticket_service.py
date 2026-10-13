from math import ceil
from typing import Any

from app.repositories.employee_support_ticket_repository import (
    EmployeeSupportTicketRepository,
)
from app.schemas.employee_support_ticket import (
    SupportTicketCreate,
    SupportTicketStatus,
)


class EmployeeSupportTicketService:
    def __init__(self):
        self.repository = EmployeeSupportTicketRepository()

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