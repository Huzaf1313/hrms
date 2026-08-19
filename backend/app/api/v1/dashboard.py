from fastapi import APIRouter

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
async def get_dashboard():
    dashboard = await service.get_dashboard_data()

    return APIResponse(
        success=True,
        message="Dashboard data retrieved successfully",
        data=dashboard,
    )