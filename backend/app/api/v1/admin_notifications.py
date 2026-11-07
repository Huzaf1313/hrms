from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_current_user
from app.core.roles import ADMIN_ROLES, Permission, UserRole, role_value
from app.schemas.common import APIResponse
from app.schemas.employee_notification import NotificationListResponse
from app.services.admin_notification_service import AdminNotificationService


router = APIRouter()

service = AdminNotificationService()


# Admin accounts have no employee_id of their own, so they are addressed by the
# notification service's "admin:<user id>" key instead of the employee code.
def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if role_value(current_user.get("role")) not in ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    return current_user


@router.get(
    "/admin/notifications",
    response_model=APIResponse[NotificationListResponse],
)
async def get_admin_notifications(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_admin),
):
    skip = (page - 1) * limit

    data = await service.get_for_admin(
        admin_user_id=str(current_user["_id"]),
        skip=skip,
        limit=limit,
    )

    return APIResponse(
        success=True,
        message="Notifications retrieved successfully",
        data=NotificationListResponse(**data),
    )


@router.get(
    "/admin/notifications/unread-count",
)
async def get_admin_unread_count(
    current_user: dict = Depends(require_admin),
):
    unread_count = await service.get_unread_count(
        str(current_user["_id"])
    )

    return APIResponse(
        success=True,
        message="Unread count retrieved successfully",
        data={"unread_count": unread_count},
    )


@router.patch(
    "/admin/notifications/{notification_id}/read",
)
async def mark_admin_notification_as_read(
    notification_id: str,
    current_user: dict = Depends(require_admin),
):
    notification = await service.mark_as_read(
        notification_id=notification_id,
        admin_user_id=str(current_user["_id"]),
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found",
        )

    return APIResponse(
        success=True,
        message="Notification marked as read",
        data=notification,
    )


@router.patch(
    "/admin/notifications/read-all",
)
async def mark_all_admin_notifications_as_read(
    current_user: dict = Depends(require_admin),
):
    modified_count = await service.mark_all_as_read(
        str(current_user["_id"])
    )

    return APIResponse(
        success=True,
        message="All notifications marked as read",
        data={"modified_count": modified_count},
    )