from fastapi import APIRouter, Depends

from app.api.deps import require_permission
from app.core.cache import get_cache, set_cache
from app.core.roles import Permission
from app.core.common_schemas import APIResponse
from app.modules.dashboard.schemas import DashboardResponse
from app.modules.dashboard.service import DashboardService


router = APIRouter(
    tags=["Dashboard"]
)

service = DashboardService()
DASHBOARD_CACHE_TTL = 60


@router.get(
    "/dashboard",
    response_model=APIResponse[DashboardResponse],
)
async def get_dashboard(
    current_user: dict = Depends(
        require_permission(Permission.ORGANIZATION_READ)
    ),
):
    user_role = getattr(current_user.get("role"), "value", current_user.get("role"))
    user_id = str(current_user.get("_id", ""))
    cache_key = f"dashboard:{user_role}:{user_id}"

    cached_data = await get_cache(cache_key)
    if cached_data is not None:
        try:
            cached_model = DashboardResponse(**cached_data)
            return APIResponse(
                success=True,
                message="Dashboard data retrieved successfully",
                data=cached_model,
            )
        except Exception:
            pass

    dashboard = await service.get_dashboard_data(current_user=current_user)
    dashboard_model = DashboardResponse(**dashboard)

    await set_cache(cache_key, dashboard_model.model_dump(), ttl=DASHBOARD_CACHE_TTL)

    return APIResponse(
        success=True,
        message="Dashboard data retrieved successfully",
        data=dashboard_model,
    )