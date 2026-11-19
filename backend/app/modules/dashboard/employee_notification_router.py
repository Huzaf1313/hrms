from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_current_user
from app.modules.dashboard.notification_schemas import (
    NotificationListResponse,
    NotificationResponse,
)
from app.modules.dashboard.employee_notification_service import (
    EmployeeNotificationService,
)


router = APIRouter(
    prefix="/notifications",
    tags=["Employee Notifications"],
)

service = EmployeeNotificationService()


@router.get(
    "",
    response_model=NotificationListResponse,
)
async def get_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    employee_id = current_user.get("employee_id")

    if not employee_id:
        raise HTTPException(
            status_code=400,
            detail="Employee ID not found for current user",
        )

    skip = (page - 1) * limit

    data = await service.get_for_employee(
        employee_id=employee_id,
        skip=skip,
        limit=limit,
    )

    return {
        "notifications": data["notifications"],
        "total": len(data["notifications"]),
        "unread_count": data["unread_count"],
    }


@router.get(
    "/unread-count",
)
async def get_unread_count(
    current_user: dict = Depends(get_current_user),
):
    employee_id = current_user.get("employee_id")

    if not employee_id:
        raise HTTPException(
            status_code=400,
            detail="Employee ID not found for current user",
        )

    unread_count = await service.get_unread_count(
        employee_id
    )

    return {
        "success": True,
        "unread_count": unread_count,
    }


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
)
async def mark_notification_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    employee_id = current_user.get("employee_id")

    if not employee_id:
        raise HTTPException(
            status_code=400,
            detail="Employee ID not found for current user",
        )

    notification = await service.mark_as_read(
        notification_id=notification_id,
        employee_id=employee_id,
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found",
        )

    return notification


@router.patch(
    "/read-all",
)
async def mark_all_notifications_as_read(
    current_user: dict = Depends(get_current_user),
):
    employee_id = current_user.get("employee_id")

    if not employee_id:
        raise HTTPException(
            status_code=400,
            detail="Employee ID not found for current user",
        )

    modified_count = await service.mark_all_as_read(
        employee_id
    )

    return {
        "success": True,
        "message": "All notifications marked as read",
        "modified_count": modified_count,
    }