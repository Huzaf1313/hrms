from fastapi import APIRouter, Depends

from app.core.roles import Permission
from app.api.deps import require_permission
from app.schemas.admin_payslip import AdminPayslipCreate
from app.services.admin_payslip_service import AdminPayslipService


router = APIRouter(
    prefix="/admin-payslip",
    tags=["Admin Payslip"],
)

service = AdminPayslipService()


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

    return {
        "success": True,
        "message": "Payslip created successfully",
        "data": payslip,
    }
@router.get(
    "",
    summary="Get All Admin Payslips",
    description="Get all employee payslips with pagination.",
)
async def get_all_payslips(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(
        require_permission(Permission.PAYSLIPS_READ)
    ),
):
    payslips = await service.get_all_payslips(
        page=page,
        limit=limit,
    )

    return {
        "success": True,
        "message": "Payslips retrieved successfully",
        "data": payslips,
    }

@router.get(
    "",
    summary="Get All Admin Payslips",
    description="Get all employee payslips with pagination.",
)
async def get_all_payslips(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(
        require_permission(Permission.PAYSLIPS_READ)
    ),
):
    payslips = await service.get_all_payslips(
        page=page,
        limit=limit,
    )

    return {
        "success": True,
        "message": "Payslips retrieved successfully",
        "data": payslips,
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
    payslip = await service.get_payslip_by_id(
        payslip_id
    )

    return {
        "success": True,
        "message": "Payslip retrieved successfully",
        "data": payslip,
    }

