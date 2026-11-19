import logging
from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_permission
from app.core.exceptions import AppException
from app.core.roles import Permission
from app.core.common_schemas import APIResponse
from app.modules.holidays.schemas import (
    HolidayCreate,
    HolidayResponse,
    HolidayUpdate,
)
from app.modules.holidays.service import HolidayService
from app.core.cache import (
    get_cache,
    set_cache,
    invalidate_holidays_cache,
)

logger = logging.getLogger(__name__)

router = APIRouter()

service = HolidayService()
HOLIDAYS_CACHE_TTL = 3600


def _as_iso(value: date | None) -> str | None:
    return value.isoformat() if value else None


# Readable by employees, because the employee attendance calendar marks holidays.
# Both bounds are optional: omitting them returns every holiday on record.
@router.get(
    "/holidays",
    response_model=APIResponse[list[HolidayResponse]],
)
async def get_holidays(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    department_id: str | None = Query(default=None),
    current_user: dict = Depends(require_permission(Permission.HOLIDAY_READ)),
):
    if start_date and end_date and end_date < start_date:
        raise AppException("End date cannot be before start date", 400)

    start_iso = _as_iso(start_date) or "all"
    end_iso = _as_iso(end_date) or "all"
    dep_iso = department_id or "all"
    cache_key = f"holidays:{start_iso}:{end_iso}:{dep_iso}"

    cached_data = await get_cache(cache_key)
    if cached_data is not None:
        try:
            cached_models = [HolidayResponse(**item) for item in cached_data]
            return APIResponse(
                success=True,
                message="Holidays retrieved successfully",
                data=cached_models,
            )
        except Exception:
            pass

    holidays = await service.get_holidays(
        start_date=_as_iso(start_date),
        end_date=_as_iso(end_date),
        department_id=department_id,
    )

    await set_cache(
        cache_key,
        [h.model_dump() for h in holidays],
        ttl=HOLIDAYS_CACHE_TTL,
    )

    return APIResponse(
        success=True,
        message="Holidays retrieved successfully",
        data=holidays,
    )


@router.post(
    "/admin/holidays",
    response_model=APIResponse[HolidayResponse],
)
async def create_holiday(
    data: HolidayCreate,
    current_user: dict = Depends(require_permission(Permission.HOLIDAY_CREATE)),
):
    holiday = await service.create_holiday(data.model_dump())

    try:
        await invalidate_holidays_cache()
    except Exception as exc:
        logger.error("Failed to invalidate holiday cache after create: %s", exc)

    return APIResponse(
        success=True,
        message="Holiday created successfully",
        data=holiday,
    )


@router.put(
    "/admin/holidays/{holiday_id}",
    response_model=APIResponse[HolidayResponse],
)
async def update_holiday(
    holiday_id: str,
    data: HolidayUpdate,
    current_user: dict = Depends(require_permission(Permission.HOLIDAY_UPDATE)),
):
    # exclude_unset keeps a field the form did not send from overwriting what is
    # already stored, while still letting a null description clear the field.
    holiday = await service.update_holiday(
        holiday_id,
        data.model_dump(exclude_unset=True),
    )

    try:
        await invalidate_holidays_cache()
    except Exception as exc:
        logger.error("Failed to invalidate holiday cache after update: %s", exc)

    return APIResponse(
        success=True,
        message="Holiday updated successfully",
        data=holiday,
    )


@router.delete(
    "/admin/holidays/{holiday_id}",
    response_model=APIResponse[None],
)
async def delete_holiday(
    holiday_id: str,
    current_user: dict = Depends(require_permission(Permission.HOLIDAY_DELETE)),
):
    await service.delete_holiday(holiday_id)

    try:
        await invalidate_holidays_cache()
    except Exception as exc:
        logger.error("Failed to invalidate holiday cache after delete: %s", exc)

    return APIResponse(
        success=True,
        message="Holiday deleted successfully",
        data=None,
    )