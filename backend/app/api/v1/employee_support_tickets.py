from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.core.exceptions import AppException
from app.schemas.employee_support_ticket import (
    SupportTicketCreate,
    SupportTicketResponse,
    SupportTicketsResponse,
)
from app.services.employee_support_ticket_service import (
    EmployeeSupportTicketService,
)


router = APIRouter(
    prefix="/employee-support-tickets",
    tags=["Employee Support Tickets"],
)

service = EmployeeSupportTicketService()


def employee_identity(current_user: dict) -> str:
    """Resolve the authenticated employee's profile ID."""
    employee_id = current_user.get("employee_id")

    if not employee_id:
        raise AppException("Employee profile not found", 404)

    return str(employee_id)


@router.post(
    "",
    response_model=SupportTicketResponse,
    status_code=201,
)
async def create_employee_support_ticket(
    data: SupportTicketCreate,
    current_user: dict = Depends(get_current_user),
):
    employee_id = employee_identity(current_user)

    return await service.create_ticket(
        data=data,
        employee_id=employee_id,
    )


@router.get(
    "",
    response_model=SupportTicketsResponse,
)
async def get_my_support_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    employee_id = employee_identity(current_user)

    return await service.get_my_tickets(
        employee_id=employee_id,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{ticket_id}",
    response_model=SupportTicketResponse,
)
async def get_my_support_ticket(
    ticket_id: str,
    current_user: dict = Depends(get_current_user),
):
    employee_id = employee_identity(current_user)

    ticket = await service.get_ticket(
        ticket_id=ticket_id,
        employee_id=employee_id,
    )

    if not ticket:
        raise AppException("Support ticket not found", 404)

    return ticket