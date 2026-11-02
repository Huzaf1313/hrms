import logging
from fastapi import APIRouter, Depends

from app.api.deps import require_permission
from app.core.exceptions import AppException
from app.core.roles import Permission
from app.schemas.common import APIResponse
from app.schemas.admin_deduction import (
    AdminDeductionCreate,
    AdminDeductionResponse,
    AdminDeductionUpdate,
    ApplyDeductionRequest,
    DeductionCalculationRequest,
    DeductionCalculationResponse,
)
from app.services.admin_deduction_service import AdminDeductionService
from app.core.cache import (
    get_cache,
    set_cache,
    invalidate_deductions_cache,
    invalidate_salary_structures_cache,
)

logger = logging.getLogger(__name__)

router = APIRouter()

service = AdminDeductionService()
DEDUCTION_CONFIG_CACHE_TTL = 300


@router.post(
    "/admin/deductions",
    response_model=APIResponse[AdminDeductionResponse],
)
async def create_deduction(
    data: AdminDeductionCreate,
    current_user: dict = Depends(
        require_permission(Permission.PAYROLL_MANAGE)
    ),
):
    deduction = await service.create_deduction(
        data.model_dump()
    )

    try:
        await invalidate_deductions_cache()
    except Exception as exc:
        logger.error("Failed to invalidate deductions cache after create: %s", exc)

    return APIResponse(
        success=True,
        message="Deduction or contribution created successfully",
        data=deduction,
    )


@router.get(
    "/admin/deductions",
    response_model=APIResponse[list[AdminDeductionResponse]],
)
async def get_deductions(
    current_user: dict = Depends(
        require_permission(Permission.PAYROLL_MANAGE)
    ),
):
    user_role = getattr(current_user.get("role"), "value", current_user.get("role"))
    cache_key = f"deductions:list:{user_role}"

    cached_data = await get_cache(cache_key)
    if cached_data is not None:
        try:
            cached_models = [AdminDeductionResponse(**item) for item in cached_data]
            return APIResponse(
                success=True,
                message="Deductions and contributions retrieved successfully",
                data=cached_models,
            )
        except Exception:
            pass

    deductions = await service.get_all_deductions()
    await set_cache(
        cache_key,
        [d.model_dump() for d in deductions],
        ttl=DEDUCTION_CONFIG_CACHE_TTL,
    )

    return APIResponse(
        success=True,
        message="Deductions and contributions retrieved successfully",
        data=deductions,
    )


@router.get(
    "/admin/deductions/{deduction_id}",
    response_model=APIResponse[AdminDeductionResponse],
)
async def get_deduction(
    deduction_id: str,
    current_user: dict = Depends(
        require_permission(Permission.PAYROLL_MANAGE)
    ),
):
    user_role = getattr(current_user.get("role"), "value", current_user.get("role"))
    cache_key = f"deductions:detail:{user_role}:{deduction_id}"

    cached_data = await get_cache(cache_key)
    if cached_data is not None:
        try:
            cached_model = AdminDeductionResponse(**cached_data)
            return APIResponse(
                success=True,
                message="Deduction or contribution retrieved successfully",
                data=cached_model,
            )
        except Exception:
            pass

    deduction = await service.get_deduction(deduction_id)
    await set_cache(
        cache_key,
        deduction.model_dump(),
        ttl=DEDUCTION_CONFIG_CACHE_TTL,
    )

    return APIResponse(
        success=True,
        message="Deduction or contribution retrieved successfully",
        data=deduction,
    )


@router.put(
    "/admin/deductions/{deduction_id}",
    response_model=APIResponse[AdminDeductionResponse],
)
async def update_deduction(
    deduction_id: str,
    data: AdminDeductionUpdate,
    current_user: dict = Depends(
        require_permission(Permission.PAYROLL_MANAGE)
    ),
):
    deduction = await service.update_deduction(
        deduction_id,
        data.model_dump(),
    )

    try:
        await invalidate_deductions_cache(deduction_id)
    except Exception as exc:
        logger.error("Failed to invalidate deductions cache after update: %s", exc)

    return APIResponse(
        success=True,
        message="Deduction or contribution updated successfully",
        data=deduction,
    )


@router.delete(
    "/admin/deductions/{deduction_id}",
    response_model=APIResponse[None],
)
async def delete_deduction(
    deduction_id: str,
    current_user: dict = Depends(
        require_permission(Permission.PAYROLL_MANAGE)
    ),
):
    await service.delete_deduction(deduction_id)

    try:
        await invalidate_deductions_cache(deduction_id)
    except Exception as exc:
        logger.error("Failed to invalidate deductions cache after delete: %s", exc)

    return APIResponse(
        success=True,
        message="Deduction or contribution deleted successfully",
        data=None,
    )


@router.post(
    "/admin/deductions/{deduction_id}/apply",
    response_model=APIResponse[dict],
)
async def apply_deduction_to_salary_structures(
    deduction_id: str,
    payload: ApplyDeductionRequest | None = None,
    current_user: dict = Depends(
        require_permission(Permission.PAYROLL_MANAGE)
    ),
):
    structure_ids = payload.get_structure_ids() if payload else []
    if not structure_ids:
        raise AppException("At least one salary structure must be selected", 400)

    updated_count = await service.apply_to_salary_structures(
        deduction_id=deduction_id,
        structure_ids=structure_ids,
    )

    try:
        await invalidate_deductions_cache(deduction_id)
        await invalidate_salary_structures_cache()
    except Exception as exc:
        logger.error("Failed to invalidate cache after applying deduction: %s", exc)

    return APIResponse(
        success=True,
        message=f"Deduction or contribution applied to {updated_count} salary structure(s)",
        data={"updated_structures": updated_count},
    )


@router.post(
    "/admin/deductions/calculate",
    response_model=APIResponse[DeductionCalculationResponse],
)
async def calculate_deductions(
    data: DeductionCalculationRequest,
    current_user: dict = Depends(
        require_permission(Permission.PAYROLL_MANAGE)
    ),
):
    calculation = await service.calculate_deductions(
        basic_salary=data.basic_salary,
        annual_income=data.annual_income,
    )

    return APIResponse(
        success=True,
        message="Deduction calculation completed successfully",
        data=calculation,
    )
