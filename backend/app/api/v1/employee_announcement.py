from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_current_user
from app.core.exceptions import AppException
from app.schemas.employee_announcement import (
    EmployeeAnnouncementCreate,
    EmployeeAnnouncementResponse,
    EmployeeAnnouncementUpdate,
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


@router.get(
    "",
    response_model=EmployeeAnnouncementsResponse,
)
async def get_employee_announcements(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    category: str | None = Query(None),
    search: str | None = Query(None),
    current_user=Depends(get_current_user),
):
    return await service.get_published(
        page=page,
        page_size=page_size,
        category=category,
        search=search,
    )


@router.get(
    "/{announcement_id}",
    response_model=EmployeeAnnouncementResponse,
)
async def get_employee_announcement(
    announcement_id: str,
    current_user=Depends(get_current_user),
):
    announcement = await service.get_by_id(announcement_id)

    if not announcement:
        raise AppException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found",
        )

    return announcement