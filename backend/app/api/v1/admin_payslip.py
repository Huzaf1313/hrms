import logging
from fastapi import APIRouter, Depends, Query

from app.core.roles import Permission
from app.api.deps import require_permission
from app.schemas.admin_payslip import (
    AdminPayslipCreate,
    PayrollAnalyticsResponse,
    PayslipStatusUpdate,
)
from app.schemas.common import APIResponse
from app.core.exceptions import AppException
from app.core.cache import (
    get_cache,
    set_cache,
    invalidate_payroll_analytics_cache,
    invalidate_payslips_cache,
    invalidate_employee_payroll_cache,
)
from app.services.admin_payslip_service import AdminPayslipService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin-payslip",
    tags=["Admin Payslip"],
)

service = AdminPayslipService()
PAYROLL_ANALYTICS_CACHE_TTL = 120
PAYSLIP_LIST_CACHE_TTL = 120
PAYSLIP_DETAIL_CACHE_TTL = 300


@router.post("")
async def create_payslip(
    payload: AdminPayslipCreate,
    current_user: dict = Depends(
        require_permission(Permission.PAYROLL_PROCESS)
    ),
):
    payslip = await service.create_payslip(
        employee_id=payload.employee_id,
        month=payload.month,
        year=payload.year,
    )

    try:
        await invalidate_payroll_analytics_cache()
        await invalidate_payslips_cache()
        await invalidate_employee_payroll_cache(payload.employee_id)
    except Exception as exc:
        logger.error("Failed to invalidate payroll cache after payslip creation: %s", exc)

    return {
        "success": True,
        "message": "Payslip created successfully",
        "data": payslip,
    }


@router.get(
    "/analytics",
    summary="Get Payroll Analytics",
    description="Get aggregated monthly payroll analytics for admin overview chart and metrics.",
    response_model=APIResponse[PayrollAnalyticsResponse],
)
async def get_payroll_analytics(
    year: int | None = None,
    months: int | None = 6,
    current_user: dict = Depends(
        require_permission(Permission.PAYROLL_READ)
    ),
):
    user_role = getattr(current_user.get("role"), "value", current_user.get("role"))
    user_id = str(current_user.get("_id", ""))
    cache_key = f"payroll:analytics:{user_role}:{user_id}:{year}:{months}"

    cached_data = await get_cache(cache_key)
    if cached_data is not None:
        try:
            cached_model = PayrollAnalyticsResponse(**cached_data)
            return APIResponse(
                success=True,
                message="Payroll analytics retrieved successfully",
                data=cached_model,
            )
        except Exception:
            pass

    analytics = await service.get_payroll_analytics(
        year=year,
        months=months,
    )
    analytics_model = PayrollAnalyticsResponse(**analytics)

    await set_cache(cache_key, analytics_model.model_dump(), ttl=PAYROLL_ANALYTICS_CACHE_TTL)

    return APIResponse(
        success=True,
        message="Payroll analytics retrieved successfully",
        data=analytics_model,
    )


@router.get(
    "",
    summary="Get All Admin Payslips",
    description="Get all employee payslips with pagination and filtering.",
)
async def get_all_payslips(
    page: int = 1,
    limit: int = 20,
    month: str | None = None,
    year: int | None = None,
    search: str | None = None,
    status: str | None = None,
    current_user: dict = Depends(
        require_permission(Permission.PAYROLL_READ)
    ),
):
    search_str = search.strip().lower() if search else "none"
    cache_key = f"payroll:payslips:list:{year or 'all'}:{month or 'all'}:{status or 'all'}:{search_str}:{page}:{limit}"

    cached = await get_cache(cache_key)
    if cached is not None:
        return {
            "success": True,
            "message": "Payslips retrieved successfully",
            "data": cached,
        }

    payslips = await service.get_all_payslips(
        page=page,
        limit=limit,
        month=month,
        year=year,
        search=search,
        status=status,
    )

    await set_cache(cache_key, payslips, ttl=PAYSLIP_LIST_CACHE_TTL)

    return {
        "success": True,
        "message": "Payslips retrieved successfully",
        "data": payslips,
    }


@router.patch(
    "/{payslip_id}/status",
    summary="Update Payslip Status",
    description="Update payslip payment status (e.g., Paid, Credited, Processing).",
)
async def update_payslip_status(
    payslip_id: str,
    payload: PayslipStatusUpdate,
    current_user: dict = Depends(
        require_permission(Permission.PAYROLL_PROCESS)
    ),
):
    updated = await service.update_payslip_status(
        payslip_id=payslip_id,
        status=payload.status,
    )

    try:
        await invalidate_payroll_analytics_cache()
        await invalidate_payslips_cache(payslip_id)
        emp_id = updated.get("employee_id") if isinstance(updated, dict) else None
        await invalidate_employee_payroll_cache(emp_id)
    except Exception as exc:
        logger.error("Failed to invalidate payroll cache after payslip status update: %s", exc)

    return {
        "success": True,
        "message": "Payslip status updated successfully",
        "data": updated,
    }


@router.get(
    "/{payslip_id}",
    summary="Get Admin Payslip By ID",
    description="Get a single employee payslip by payslip ID.",
)
async def get_payslip_by_id(
    payslip_id: str,
    current_user: dict = Depends(
        require_permission(Permission.PAYSLIPS_READ)
    ),
):
    cache_key = f"payroll:payslips:detail:{payslip_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return {
            "success": True,
            "message": "Payslip retrieved successfully",
            "data": cached,
        }

    payslip = await service.get_payslip_by_id(
        payslip_id
    )

    await set_cache(cache_key, payslip, ttl=PAYSLIP_DETAIL_CACHE_TTL)

    return {
        "success": True,
        "message": "Payslip retrieved successfully",
        "data": payslip,
    }


@router.get(
    "/{payslip_id}/download",
    summary="Download Admin Payslip (Disabled)",
    description="Payslip PDF download has been retired and disabled.",
)
async def download_payslip(payslip_id: str):
    raise AppException(
        "Payslip PDF download has been disabled",
        410,
    )
