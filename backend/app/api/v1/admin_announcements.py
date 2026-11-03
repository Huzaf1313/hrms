import logging
from datetime import date

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from app.api.deps import require_permission
from app.core.cache import (
    get_cache,
    invalidate_announcements_cache,
    set_cache,
)
from app.core.roles import Permission
from app.schemas.admin_announcement import (
    AdminAnnouncementCreate,
    AdminAnnouncementResponse,
    AnnouncementAudience,
    AnnouncementCategory,
    AnnouncementPriority,
)
from app.schemas.common import APIResponse
from app.services.admin_announcement_service import AdminAnnouncementService

logger = logging.getLogger(__name__)

ADMIN_ANNOUNCEMENT_LIST_CACHE_TTL = 180
ADMIN_ANNOUNCEMENT_DETAIL_CACHE_TTL = 300

router = APIRouter()

service = AdminAnnouncementService()


@router.post(
    "/announcements",
    response_model=APIResponse[AdminAnnouncementResponse],
)
async def create_announcement(
    title: str = Form(...),
    category: AnnouncementCategory = Form(...),
    priority: AnnouncementPriority = Form(AnnouncementPriority.NORMAL),
    publish_date: date = Form(...),
    expiry_date: date | None = Form(None),
    audience: AnnouncementAudience = Form(AnnouncementAudience.ALL_EMPLOYEES),
    description: str = Form(...),
    pinned: bool = Form(False),
    target_departments: list[str] = Form(default_factory=list),
    target_employees: list[str] = Form(default_factory=list),
    attachment: UploadFile | None = File(None),
    current_user: dict = Depends(require_permission(Permission.ANNOUNCEMENT_MANAGE)),
):
    data = AdminAnnouncementCreate(
        title=title,
        category=category,
        priority=priority,
        publish_date=publish_date,
        expiry_date=expiry_date,
        audience=audience,
        description=description,
        pinned=pinned,
        target_departments=target_departments,
        target_employees=target_employees,
    )

    announcement = await service.create_announcement(
        data.model_dump(),
        author=current_user,
        attachment=attachment,
    )

    try:
        await invalidate_announcements_cache()
    except Exception as exc:
        logger.error("Failed to invalidate announcements cache after create: %s", exc)

    return APIResponse(
        success=True,
        message="Announcement created successfully",
        data=announcement,
    )


@router.get(
    "/announcements",
    response_model=APIResponse[list[AdminAnnouncementResponse]],
)
async def get_announcements(
    category: str | None = Query(None),
    search: str | None = Query(None),
    pinned: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_permission(Permission.ANNOUNCEMENT_MANAGE)),
):
    skip_val = skip if isinstance(skip, int) else 0
    limit_val = limit if isinstance(limit, int) else 20
    cat_val = category if isinstance(category, str) else None
    search_val = (
        search.strip().lower()
        if isinstance(search, str) and search.strip()
        else "none"
    )
    pinned_val = pinned if isinstance(pinned, bool) else None

    cache_key = (
        f"announcements:admin:list:{cat_val or 'all'}:{search_val}:{pinned_val}:{skip_val}:{limit_val}"
    )

    cached = await get_cache(cache_key)
    if cached is not None:
        try:
            return APIResponse(
                success=True,
                message="Announcements retrieved successfully",
                data=[AdminAnnouncementResponse(**item) for item in cached],
            )
        except Exception:
            pass

    announcements, _total = await service.get_announcements(
        category=cat_val,
        search=search_val if search_val != "none" else None,
        pinned=pinned_val,
        skip=skip_val,
        limit=limit_val,
    )

    await set_cache(
        cache_key,
        [
            item.model_dump(mode="json")
            if hasattr(item, "model_dump")
            else item
            for item in announcements
        ],
        ttl=ADMIN_ANNOUNCEMENT_LIST_CACHE_TTL,
    )

    return APIResponse(
        success=True,
        message="Announcements retrieved successfully",
        data=announcements,
    )


@router.get(
    "/announcements/{announcement_id}",
    response_model=APIResponse[AdminAnnouncementResponse],
)
async def get_announcement(
    announcement_id: str,
    current_user: dict = Depends(require_permission(Permission.ANNOUNCEMENT_MANAGE)),
):
    cache_key = f"announcements:admin:detail:{announcement_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        try:
            return APIResponse(
                success=True,
                message="Announcement retrieved successfully",
                data=AdminAnnouncementResponse(**cached),
            )
        except Exception:
            pass

    announcement = await service.get_announcement(announcement_id)

    await set_cache(
        cache_key,
        announcement.model_dump(mode="json")
        if hasattr(announcement, "model_dump")
        else announcement,
        ttl=ADMIN_ANNOUNCEMENT_DETAIL_CACHE_TTL,
    )

    return APIResponse(
        success=True,
        message="Announcement retrieved successfully",
        data=announcement,
    )


@router.put(
    "/announcements/{announcement_id}",
    response_model=APIResponse[AdminAnnouncementResponse],
)
async def update_announcement(
    announcement_id: str,
    title: str | None = Form(None),
    category: AnnouncementCategory | None = Form(None),
    priority: AnnouncementPriority | None = Form(None),
    publish_date: date | None = Form(None),
    expiry_date: date | None = Form(None),
    audience: AnnouncementAudience | None = Form(None),
    description: str | None = Form(None),
    pinned: bool | None = Form(None),
    target_departments: list[str] = Form(default_factory=list),
    target_employees: list[str] = Form(default_factory=list),
    clear_expiry: bool = Form(False),
    remove_attachment: bool = Form(False),
    attachment: UploadFile | None = File(None),
    current_user: dict = Depends(require_permission(Permission.ANNOUNCEMENT_MANAGE)),
):
    update_data = {
        "title": title,
        "category": category,
        "priority": priority,
        "publish_date": publish_date,
        "expiry_date": expiry_date,
        "audience": audience,
        "description": description,
        "pinned": pinned,
        "target_departments": target_departments,
        "target_employees": target_employees,
    }

    announcement = await service.update_announcement(
        announcement_id,
        update_data,
        attachment=attachment,
        clear_expiry=clear_expiry,
        remove_attachment=remove_attachment,
    )

    try:
        await invalidate_announcements_cache()
    except Exception as exc:
        logger.error("Failed to invalidate announcements cache after update: %s", exc)

    return APIResponse(
        success=True,
        message="Announcement updated successfully",
        data=announcement,
    )


@router.delete(
    "/announcements/{announcement_id}",
    response_model=APIResponse[None],
)
async def delete_announcement(
    announcement_id: str,
    current_user: dict = Depends(require_permission(Permission.ANNOUNCEMENT_MANAGE)),
):
    await service.delete_announcement(announcement_id)

    try:
        await invalidate_announcements_cache()
    except Exception as exc:
        logger.error("Failed to invalidate announcements cache after delete: %s", exc)

    return APIResponse(
        success=True,
        message="Announcement deleted successfully",
        data=None,
    )
