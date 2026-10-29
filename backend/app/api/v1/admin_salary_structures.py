import logging
from fastapi import APIRouter, Depends

from app.api.deps import require_permission
from app.core.roles import Permission
from app.schemas.common import APIResponse
from app.schemas.admin_salary_structure import (
    AdminSalaryStructureCreate,
    AdminSalaryStructureResponse,
    AdminSalaryStructureUpdate,
)
from app.services.admin_salary_structure_service import AdminSalaryStructureService
from app.core.cache import (
    get_cache,
    set_cache,
    invalidate_salary_structures_cache,
)

logger = logging.getLogger(__name__)

router = APIRouter()

service = AdminSalaryStructureService()
SALARY_STRUCTURE_CACHE_TTL = 300


@router.post(
    "/admin/salary-structures",
    response_model=APIResponse[AdminSalaryStructureResponse],
)
async def create_salary_structure(
    data: AdminSalaryStructureCreate,
    current_user: dict = Depends(require_permission(Permission.PAYROLL_MANAGE)),
):
    structure = await service.create_structure(data.model_dump())

    try:
        await invalidate_salary_structures_cache()
    except Exception as exc:
        logger.error("Failed to invalidate salary structures cache after create: %s", exc)

    return APIResponse(
        success=True,
        message="Salary structure created successfully",
        data=structure,
    )


@router.get(
    "/admin/salary-structures",
    response_model=APIResponse[list[AdminSalaryStructureResponse]],
)
async def get_salary_structures(
    current_user: dict = Depends(require_permission(Permission.SALARY_STRUCTURE_READ)),
):
    user_role = getattr(current_user.get("role"), "value", current_user.get("role"))
    cache_key = f"salary_structures:list:{user_role}"

    cached_data = await get_cache(cache_key)
    if cached_data is not None:
        try:
            cached_models = [AdminSalaryStructureResponse(**item) for item in cached_data]
            return APIResponse(
                success=True,
                message="Salary structures retrieved successfully",
                data=cached_models,
            )
        except Exception:
            pass

    structures = await service.get_all_structures()
    await set_cache(
        cache_key,
        [s.model_dump() for s in structures],
        ttl=SALARY_STRUCTURE_CACHE_TTL,
    )

    return APIResponse(
        success=True,
        message="Salary structures retrieved successfully",
        data=structures,
    )


@router.get(
    "/admin/salary-structures/{structure_id}",
    response_model=APIResponse[AdminSalaryStructureResponse],
)
async def get_salary_structure(
    structure_id: str,
    current_user: dict = Depends(require_permission(Permission.SALARY_STRUCTURE_READ)),
):
    user_role = getattr(current_user.get("role"), "value", current_user.get("role"))
    cache_key = f"salary_structures:detail:{user_role}:{structure_id}"

    cached_data = await get_cache(cache_key)
    if cached_data is not None:
        try:
            cached_model = AdminSalaryStructureResponse(**cached_data)
            return APIResponse(
                success=True,
                message="Salary structure retrieved successfully",
                data=cached_model,
            )
        except Exception:
            pass

    structure = await service.get_structure(structure_id)
    await set_cache(
        cache_key,
        structure.model_dump(),
        ttl=SALARY_STRUCTURE_CACHE_TTL,
    )

    return APIResponse(
        success=True,
        message="Salary structure retrieved successfully",
        data=structure,
    )


@router.put(
    "/admin/salary-structures/{structure_id}",
    response_model=APIResponse[AdminSalaryStructureResponse],
)
async def update_salary_structure(
    structure_id: str,
    data: AdminSalaryStructureUpdate,
    current_user: dict = Depends(require_permission(Permission.PAYROLL_MANAGE)),
):
    structure = await service.update_structure(
        structure_id,
        data.model_dump(),
    )

    try:
        await invalidate_salary_structures_cache(structure_id)
    except Exception as exc:
        logger.error("Failed to invalidate salary structures cache after update: %s", exc)

    return APIResponse(
        success=True,
        message="Salary structure updated successfully",
        data=structure,
    )


@router.delete(
    "/admin/salary-structures/{structure_id}",
    response_model=APIResponse[None],
)
async def delete_salary_structure(
    structure_id: str,
    current_user: dict = Depends(require_permission(Permission.PAYROLL_MANAGE)),
):
    await service.delete_structure(structure_id)

    try:
        await invalidate_salary_structures_cache(structure_id)
    except Exception as exc:
        logger.error("Failed to invalidate salary structures cache after delete: %s", exc)

    return APIResponse(
        success=True,
        message="Salary structure deleted successfully",
        data=None,
    )