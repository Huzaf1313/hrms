
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_current_user, require_permission
from app.core.roles import Permission, UserRole, has_permission
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


router = APIRouter(prefix="/assets", tags=["Assets"])

asset_service = AssetService()
request_service = AssetRequestService()


def _role_value(current_user: dict) -> str | None:
    role = current_user.get("role")
    return role.value if hasattr(role, "value") else role


async def require_asset_read_access(
    current_user: dict = Depends(get_current_user),
):
    role = _role_value(current_user)

    if role == UserRole.EMPLOYEE.value:
        if not current_user.get("employee_id"):
            raise HTTPException(
                status_code=403,
                detail="Employee account is missing an employee ID.",
            )
        return current_user

    if has_permission(role, Permission.ASSETS_READ):
        return current_user

    raise HTTPException(
        status_code=403,
        detail="You do not have permission to view assets.",
    )


def _as_date(value) -> date | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    if isinstance(value, str):
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None

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


# Keep literal routes above /{asset_id} so they are matched correctly.


@router.get("/stats", response_model=APIResponse[AssetStats])
async def get_asset_stats(
    current_user: dict = Depends(
        require_permission(Permission.ASSETS_READ)
    ),
):
    stats = await asset_service.get_stats(current_user)
    return APIResponse(
        success=True,
        message="Asset statistics retrieved successfully",
        data=stats,
    )


@router.get(
    "/allocation",
    response_model=APIResponse[Paginated[AllocationRow]],
)
async def get_asset_allocation(
    view: str = Query(default="employee", pattern="^(employee|department)$"),
    search: str | None = None,
    category: AssetCategory | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=5, ge=1, le=100),
    current_user: dict = Depends(
        require_permission(Permission.ASSETS_READ)
    ),
):
    pagination = PaginationParams(page=page, limit=limit)

    rows, total = await asset_service.get_allocation(
        view=view,
        search=search,
        category=category,
        pagination=pagination,
        current_user=current_user,
    )

    return APIResponse(
        success=True,
        message="Asset allocation retrieved successfully",
        data=Paginated(
            items=rows,
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
    request_type: AssetRequestType | None = None,
    status: AssetRequestStatus | None = None,
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(
        require_permission(Permission.ASSET_REQUESTS_READ)
    ),
):
    pagination = PaginationParams(page=page, limit=limit)

    requests, total = await request_service.get_requests(
        request_type=request_type,
        status=status,
        search=search,
        pagination=pagination,
        current_user=current_user,
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
    current_user: dict = Depends(
        require_permission(Permission.ASSET_REQUESTS_CREATE)
    ),
):
    # The service enforces employee/admin request rules as well, so the
    # restriction cannot be bypassed by calling the API directly.
    request = await request_service.create_request(
        data.model_dump(mode="json"),
        current_user,
    )

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
    current_user: dict = Depends(
        require_permission(Permission.ASSETS_UPDATE)
    ),
):
    request = await request_service.review_request(
        request_id=request_id,
        status=data.status,
        admin_note=data.admin_note,
        reviewed_by=str(current_user["_id"]),
        current_user=current_user,
    )

    return APIResponse(
        success=True,
        message="Asset request reviewed successfully",
        data=serialize_request(request),
    )


@router.get(
    "/recent-allocations",
    response_model=APIResponse[list[AssetResponse]],
)
async def get_recent_allocations(
    limit: int = Query(default=5, ge=1, le=100),
    current_user: dict = Depends(
        require_permission(Permission.ASSETS_READ)
    ),
):
    assets = await asset_service.get_recent_allocations(limit)

    return APIResponse(
        success=True,
        message="Recent asset allocations retrieved successfully",
        data=[serialize_asset(asset) for asset in assets],
    )


@router.post(
    "/requests/{request_id}/complete-return",
    response_model=APIResponse[AssetRequestResponse],
)
async def complete_asset_return(
    request_id: str,
    current_user: dict = Depends(
        require_permission(Permission.ASSETS_UPDATE)
    ),
):
    # Pass the acting user so the service can enforce the same visibility
    # scope as the other admin asset operations.
    request = await request_service.complete_return(
        request_id=request_id,
        reviewed_by=str(current_user["_id"]),
        current_user=current_user,
    )

    return APIResponse(
        success=True,
        message="Asset return completed successfully",
        data=serialize_request(request),
    )


@router.get(
    "",
    response_model=APIResponse[Paginated[AssetResponse]],
)
async def get_assets(
    status: AssetStatus | None = None,
    category: AssetCategory | None = None,
    search: str | None = None,
    employee_id: str | None = None,
    department_id: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=7, ge=1, le=100),
    current_user: dict = Depends(require_asset_read_access),
):
    pagination = PaginationParams(page=page, limit=limit)

    assets, total = await asset_service.get_assets(
        status=status,
        category=category,
        search=search,
        employee_id=employee_id,
        department_id=department_id,
        pagination=pagination,
        current_user=current_user,
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
    current_user: dict = Depends(
        require_permission(Permission.ASSETS_CREATE)
    ),
):
    asset = await asset_service.create_asset(
        data.model_dump(mode="json"),
        created_by=str(current_user["_id"]),
        current_user=current_user,
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
    current_user: dict = Depends(require_asset_read_access),
):
    asset = await asset_service.get_asset(asset_id, current_user)

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
    current_user: dict = Depends(
        require_permission(Permission.ASSETS_UPDATE)
    ),
):
    asset = await asset_service.update_asset(
        asset_id,
        data.model_dump(exclude_none=True, mode="json"),
        current_user,
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
    current_user: dict = Depends(
        require_permission(Permission.ASSETS_DELETE)
    ),
):
    await asset_service.delete_asset(asset_id, current_user)

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
    current_user: dict = Depends(
        require_permission(Permission.ASSETS_UPDATE)
    ),
):
    asset = await asset_service.assign_asset(
        asset_id,
        data.employee_id,
        data.issue_date,
        current_user,
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
    current_user: dict = Depends(
        require_permission(Permission.ASSETS_UPDATE)
    ),
):
    # Preserve the existing direct admin return endpoint.
    asset = await asset_service.return_asset(asset_id, current_user)

    return APIResponse(
        success=True,
        message="Asset returned successfully",
        data=serialize_asset(asset),
    )
