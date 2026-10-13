from datetime import date, datetime

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_permission
from app.core.roles import Permission
from app.schemas.asset import (
    AllocationRow,
    AssetAssign,
    AssetCategory,
    AssetCreate,
    AssetRequestCreate,
    AssetRequestResponse,
    AssetRequestReview,
    AssetRequestStatus,
    AssetRequestType,
    AssetResponse,
    AssetStats,
    AssetStatus,
    AssetUpdate,
    Paginated,
)
from app.schemas.common import APIResponse
from app.services.asset_request_service import AssetRequestService
from app.services.asset_service import AssetService
from app.utils.pagination import PaginationParams

router = APIRouter(
    prefix="/assets",
    tags=["Assets"],
)

asset_service = AssetService()
request_service = AssetRequestService()


def _as_date(value) -> date | None:
    """Read a stored midnight datetime back as a plain date."""

    if value is None:
        return None

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    return None


def serialize_asset(asset: dict) -> AssetResponse:
    return AssetResponse(
        id=str(asset["_id"]),
        asset_tag=asset["asset_tag"],
        name=asset["name"],
        category=asset["category"],
        brand_model=asset.get("brand_model"),
        serial_number=asset.get("serial_number"),
        status=asset["status"],
        assigned_to_employee_id=asset.get("assigned_to_employee_id"),
        assigned_to_name=asset.get("assigned_to_name"),
        department_id=asset.get("department_id"),
        department_name=asset.get("department_name"),
        issue_date=_as_date(asset.get("issue_date")),
        returned_at=_as_date(asset.get("returned_at")),
        purchase_date=_as_date(asset.get("purchase_date")),
        purchase_cost=asset.get("purchase_cost"),
        vendor=asset.get("vendor"),
        warranty_expiry=_as_date(asset.get("warranty_expiry")),
        notes=asset.get("notes"),
        created_at=asset["created_at"],
        updated_at=asset["updated_at"],
    )


def serialize_request(request: dict) -> AssetRequestResponse:
    return AssetRequestResponse(
        id=str(request["_id"]),
        request_tag=request["request_tag"],
        request_type=request["request_type"],
        asset_id=request.get("asset_id"),
        asset_tag=request.get("asset_tag"),
        asset_name=request["asset_name"],
        employee_id=request["employee_id"],
        employee_name=request["employee_name"],
        detail=request.get("detail"),
        reason=request.get("reason"),
        status=request["status"],
        asset_status=request.get("_asset_status"),
        requested_at=request["requested_at"],
        reviewed_at=request.get("reviewed_at"),
        reviewed_by=request.get("reviewed_by"),
        admin_note=request.get("admin_note"),
        created_at=request["created_at"],
        updated_at=request["updated_at"],
    )


# ---------------------------------------------------------------------------
# Literal paths first. FastAPI matches routes in declaration order, so
# "/stats", "/allocation" and "/requests" must be registered before
# "/{asset_id}" or they would be swallowed by the path parameter.


@router.get(
    "/stats",
    response_model=APIResponse[AssetStats],
)
async def get_asset_stats(
    current_user: dict = Depends(require_permission(Permission.ASSETS_READ)),
):
    stats = await asset_service.get_stats()

    return APIResponse(
        success=True,
        message="Asset stats retrieved successfully",
        data=AssetStats(**stats),
    )


@router.get(
    "/allocation",
    response_model=APIResponse[Paginated[AllocationRow]],
)
async def get_asset_allocation(
    view: str = Query(default="employee", pattern="^(employee|department)$"),
    search: str | None = Query(default=None),
    category: AssetCategory | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=5, ge=1, le=100),
    current_user: dict = Depends(require_permission(Permission.ASSETS_READ)),
):
    rows, total = await asset_service.get_allocation(
        view=view,
        search=search,
        category=category.value if category else None,
        pagination=PaginationParams(page=page, limit=limit),
    )

    return APIResponse(
        success=True,
        message="Asset allocation retrieved successfully",
        data=Paginated(
            items=[AllocationRow(**row) for row in rows],
            total=total,
            page=page,
            limit=limit,
        ),
    )


@router.get(
    "/requests",
    response_model=APIResponse[Paginated[AssetRequestResponse]],
)
async def get_asset_requests(
    request_type: AssetRequestType | None = Query(default=None),
    status: AssetRequestStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_permission(Permission.ASSETS_READ)),
):
    requests, total = await request_service.get_requests(
        request_type=request_type.value if request_type else None,
        status=status.value if status else None,
        search=search,
        pagination=PaginationParams(page=page, limit=limit),
    )

    return APIResponse(
        success=True,
        message="Asset requests retrieved successfully",
        data=Paginated(
            items=[serialize_request(request) for request in requests],
            total=total,
            page=page,
            limit=limit,
        ),
    )


@router.post(
    "/requests",
    response_model=APIResponse[AssetRequestResponse],
)
async def create_asset_request(
    data: AssetRequestCreate,
    current_user: dict = Depends(require_permission(Permission.ASSETS_CREATE)),
):
    request = await request_service.create_request(data.model_dump())

    return APIResponse(
        success=True,
        message="Asset request created successfully",
        data=serialize_request(request),
    )


@router.patch(
    "/requests/{request_id}/review",
    response_model=APIResponse[AssetRequestResponse],
)
async def review_asset_request(
    request_id: str,
    data: AssetRequestReview,
    current_user: dict = Depends(require_permission(Permission.ASSETS_UPDATE)),
):
    request = await request_service.review_request(
        request_id,
        data.status,
        data.admin_note,
        str(current_user["_id"]),
    )

    return APIResponse(
        success=True,
        message=f"Asset request {data.status.value} successfully",
        data=serialize_request(request),
    )


# ---------------------------------------------------------------------------
# Assets
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=APIResponse[Paginated[AssetResponse]],
)
async def get_assets(
    status: AssetStatus | None = Query(default=None),
    category: AssetCategory | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=7, ge=1, le=100),
    current_user: dict = Depends(require_permission(Permission.ASSETS_READ)),
):
    assets, total = await asset_service.get_assets(
        status=status.value if status else None,
        category=category.value if category else None,
        search=search,
        pagination=PaginationParams(page=page, limit=limit),
    )

    return APIResponse(
        success=True,
        message="Assets retrieved successfully",
        data=Paginated(
            items=[serialize_asset(asset) for asset in assets],
            total=total,
            page=page,
            limit=limit,
        ),
    )


@router.post(
    "",
    response_model=APIResponse[AssetResponse],
)
async def create_asset(
    data: AssetCreate,
    current_user: dict = Depends(require_permission(Permission.ASSETS_CREATE)),
):
    asset = await asset_service.create_asset(
        data.model_dump(),
        created_by=str(current_user["_id"]),
    )

    return APIResponse(
        success=True,
        message="Asset created successfully",
        data=serialize_asset(asset),
    )


@router.get(
    "/{asset_id}",
    response_model=APIResponse[AssetResponse],
)
async def get_asset(
    asset_id: str,
    current_user: dict = Depends(require_permission(Permission.ASSETS_READ)),
):
    asset = await asset_service.get_asset(asset_id)

    return APIResponse(
        success=True,
        message="Asset retrieved successfully",
        data=serialize_asset(asset),
    )


@router.put(
    "/{asset_id}",
    response_model=APIResponse[AssetResponse],
)
async def update_asset(
    asset_id: str,
    data: AssetUpdate,
    current_user: dict = Depends(require_permission(Permission.ASSETS_UPDATE)),
):
    asset = await asset_service.update_asset(
        asset_id,
        data.model_dump(exclude_none=True, mode="json"),
    )

    return APIResponse(
        success=True,
        message="Asset updated successfully",
        data=serialize_asset(asset),
    )


@router.delete(
    "/{asset_id}",
    response_model=APIResponse[None],
)
async def delete_asset(
    asset_id: str,
    current_user: dict = Depends(require_permission(Permission.ASSETS_DELETE)),
):
    await asset_service.delete_asset(asset_id)

    return APIResponse(
        success=True,
        message="Asset deleted successfully",
        data=None,
    )


@router.post(
    "/{asset_id}/assign",
    response_model=APIResponse[AssetResponse],
)
async def assign_asset(
    asset_id: str,
    data: AssetAssign,
    current_user: dict = Depends(require_permission(Permission.ASSETS_UPDATE)),
):
    asset = await asset_service.assign_asset(
        asset_id,
        data.employee_id,
        data.issue_date,
    )

    return APIResponse(
        success=True,
        message="Asset assigned successfully",
        data=serialize_asset(asset),
    )


@router.post(
    "/{asset_id}/return",
    response_model=APIResponse[AssetResponse],
)
async def return_asset(
    asset_id: str,
    current_user: dict = Depends(require_permission(Permission.ASSETS_UPDATE)),
):
    asset = await asset_service.return_asset(asset_id)

    return APIResponse(
        success=True,
        message="Asset returned successfully",
        data=serialize_asset(asset),
    )