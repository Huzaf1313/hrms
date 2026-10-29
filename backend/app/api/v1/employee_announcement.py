from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.core.cache import get_cache, set_cache
from app.core.exceptions import AppException
from app.schemas.employee_announcement import (
    EmployeeAnnouncementResponse,
    EmployeeAnnouncementsResponse,
)
from app.services.employee_announcement_service import (
    EmployeeAnnouncementService,
)

ANNOUNCEMENT_FEED_CACHE_TTL = 300
ANNOUNCEMENT_DETAIL_CACHE_TTL = 300

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

    page_val = page if isinstance(page, int) else 1
    page_size_val = page_size if isinstance(page_size, int) else 10
    cat_val = category if isinstance(category, str) else None
    search_val = (
        search.strip().lower()
        if isinstance(search, str) and search.strip()
        else "none"
    )
    pinned_val = pinned if isinstance(pinned, bool) else None

    cache_key = (
        f"announcements:feed:{user_id or 'anon'}:{department_id or 'none'}:"
        f"{cat_val or 'all'}:{search_val}:{pinned_val}:{page_val}:{page_size_val}"
    )

    cached = await get_cache(cache_key)
    if cached is not None:
        try:
            return EmployeeAnnouncementsResponse(**cached)
        except Exception:
            pass

    result = await service.get_visible(
        user_id=user_id,
        department_id=department_id,
        page=page_val,
        page_size=page_size_val,
        category=cat_val,
        search=search_val if search_val != "none" else None,
        pinned=pinned_val,
    )

    await set_cache(
        cache_key,
        result.model_dump(mode="json"),
        ttl=ANNOUNCEMENT_FEED_CACHE_TTL,
    )

    return result


@router.get(
    "/{announcement_id}",
    response_model=EmployeeAnnouncementResponse,
)
async def get_employee_announcement(
    announcement_id: str,
    current_user: dict = Depends(get_current_user),
):
    user_id, department_id = viewer_identity(current_user)

    cache_key = (
        f"announcements:emp:detail:{announcement_id}:{user_id or 'anon'}"
    )
    cached = await get_cache(cache_key)
    if cached is not None:
        try:
            return EmployeeAnnouncementResponse(**cached)
        except Exception:
            pass

    announcement = await service.get_by_id(
        announcement_id,
        user_id=user_id,
        department_id=department_id,
    )

    if not announcement:
        raise AppException("Announcement not found", 404)

    await set_cache(
        cache_key,
        announcement.model_dump(mode="json"),
        ttl=ANNOUNCEMENT_DETAIL_CACHE_TTL,
    )

    return announcement
