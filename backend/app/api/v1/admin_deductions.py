from fastapi import APIRouter, Depends

from app.api.deps import require_permission
from app.core.roles import Permission
from app.schemas.common import APIResponse
from app.schemas.admin_deduction import (
    AdminDeductionCreate,
    AdminDeductionResponse,
    AdminDeductionUpdate,
    DeductionCalculationRequest,
    DeductionCalculationResponse,
)
from app.services.admin_deduction_service import AdminDeductionService


router = APIRouter()

service = AdminDeductionService()


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
    deductions = await service.get_all_deductions()

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
    deduction = await service.get_deduction(deduction_id)

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
    current_user: dict = Depends(
        require_permission(Permission.PAYROLL_MANAGE)
    ),
):
    updated_count = await service.apply_to_all_salary_structures(deduction_id)

    return APIResponse(
        success=True,
        message="Deduction or contribution applied to all salary structures",
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
