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


router = APIRouter()

service = AdminSalaryStructureService()


@router.post(
    "/admin/salary-structures",
    response_model=APIResponse[AdminSalaryStructureResponse],
)
async def create_salary_structure(
    data: AdminSalaryStructureCreate,
    current_user: dict = Depends(require_permission(Permission.PAYROLL_MANAGE)),
):
    structure = await service.create_structure(data.model_dump())

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
    structures = await service.get_all_structures()

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
    structure = await service.get_structure(structure_id)

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

    return APIResponse(
        success=True,
        message="Salary structure deleted successfully",
        data=None,
    )