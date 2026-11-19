from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_current_user, require_permission
from app.core.exceptions import AppException
from app.core.roles import Permission
from app.core.common_schemas import APIResponse
from app.modules.support.schemas import (
    SupportTicketResponse,
    SupportTicketsResponse,
    SupportTicketUpdate,
)
from app.modules.support.service import (
    EmployeeSupportTicketService,
)


router = APIRouter()

service = EmployeeSupportTicketService()


@router.get(
    "/admin/support-tickets",
    response_model=APIResponse[SupportTicketsResponse],
)
async def get_support_tickets(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(default=None),
    category: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    search: str | None = Query(default=None),
    current_user: dict = Depends(
        require_permission(Permission.REPORTS_READ)
    ),
):
    """Every ticket across the organization, for the admin queue."""
    data = await service.list_all_tickets(
        page=page,
        page_size=limit,
        status=status,
        category=category,
        priority=priority,
        search=search,
    )

    return APIResponse(
        success=True,
        message="Support tickets retrieved successfully",
        data=SupportTicketsResponse(
            tickets=data["tickets"],
            total=data["total"],
            page=data["page"],
            page_size=data["page_size"],
            total_pages=data["total_pages"],
        ),
    )


@router.get(
    "/admin/support-tickets/summary",
)
async def get_support_ticket_summary(
    current_user: dict = Depends(
        require_permission(Permission.REPORTS_READ)
    ),
):
    """KPI row, breakdowns and aging behind the admin support dashboard."""
    analytics = await service.get_dashboard_analytics()

    return APIResponse(
        success=True,
        message="Support ticket summary retrieved successfully",
        data=analytics,
    )


@router.get(
    "/admin/support-tickets/{ticket_id}",
    response_model=APIResponse[SupportTicketResponse],
)
async def get_support_ticket(
    ticket_id: str,
    current_user: dict = Depends(
        require_permission(Permission.REPORTS_READ)
    ),
):
    ticket = await service.get_ticket_as_admin(ticket_id)

    if not ticket:
        raise AppException("Support ticket not found", 404)

    return APIResponse(
        success=True,
        message="Support ticket retrieved successfully",
        data=ticket,
    )


@router.patch(
    "/admin/support-tickets/{ticket_id}",
    response_model=APIResponse[SupportTicketResponse],
)
async def respond_to_support_ticket(
    ticket_id: str,
    data: SupportTicketUpdate,
    current_user: dict = Depends(
        require_permission(Permission.REPORTS_READ)
    ),
):
    """Answer a ticket. The employee is notified once it is moved off Open."""
    ticket = await service.respond_to_ticket(
        ticket_id=ticket_id,
        status=data.status.value,
        resolution_note=data.resolution_note,
        handled_by=str(current_user.get("full_name") or current_user["email"]),
    )

    if not ticket:
        raise HTTPException(
            status_code=404,
            detail="Support ticket not found",
        )

    return APIResponse(
        success=True,
        message="Support ticket updated successfully",
        data=ticket,
    )