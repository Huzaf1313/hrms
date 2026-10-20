from fastapi import APIRouter, Depends

from app.api.deps import require_permission
from app.core.roles import Permission
from app.schemas.common import APIResponse
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard_service import DashboardService


router = APIRouter(
    tags=["Dashboard"]
)

service = DashboardService()


@router.get(
    "/dashboard",
    response_model=APIResponse[DashboardResponse],
)
async def get_dashboard(
    current_user: dict = Depends(
        require_permission(Permission.ORGANIZATION_READ)
    ),
):
    dashboard = await service.get_dashboard_data(current_user=current_user)

    return APIResponse(
        success=True,
        message="Dashboard data retrieved successfully",
        data=dashboard,
    )