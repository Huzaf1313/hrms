from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.core.exceptions import AppException
from app.schemas.employee_announcement import (
    EmployeeAnnouncementResponse,
    EmployeeAnnouncementsResponse,
)
from app.services.employee_announcement_service import (
    EmployeeAnnouncementService,
)

router = APIRouter(
    prefix="/employee-announcements",
    tags=["Employee Announcements"],
)

service = EmployeeAnnouncementService()


def viewer_identity(current_user: dict) -> tuple[str | None, str | None]:
    """Resolve the id and department used for audience matching.

    HR targets employees by the `users` document id, which is what the admin
    employee picker stores in `target_employees`.
    """
    user_id = str(current_user.get("_id") or "") or None
    department_id = current_user.get("department_id") or None

    return user_id, department_id


@router.get(
    "",
    response_model=EmployeeAnnouncementsResponse,
)
async def get_employee_announcements(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    category: str | None = Query(None),
    search: str | None = Query(None),
    pinned: bool | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    user_id, department_id = viewer_identity(current_user)

    return await service.get_visible(
        user_id=user_id,
        department_id=department_id,
        page=page,
        page_size=page_size,
        category=category,
        search=search,
        pinned=pinned,
    )


@router.get(
    "/{announcement_id}",
    response_model=EmployeeAnnouncementResponse,
)
async def get_employee_announcement(
    announcement_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id, department_id = viewer_identity(current_user)

    announcement = await service.get_by_id(
        announcement_id,
        user_id=user_id,
        department_id=department_id,
    )

    if not announcement:
        raise AppException("Announcement not found", 404)

    return announcement
