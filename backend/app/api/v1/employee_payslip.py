from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.exceptions import AppException
from app.repositories.employee_repository import EmployeeRepository
from app.services.employee_payslip_service import EmployeePayslipService


router = APIRouter(
    prefix="/employee-payslip",
    tags=["Employee Payslip"],
)

service = EmployeePayslipService()
employee_repository = EmployeeRepository()


async def get_employee_from_user(current_user: dict):
    email = current_user.get("email")

    if not email:
        raise AppException(
            "User email not found",
            401,
        )

    employee = await employee_repository.get_by_email(email)

    if not employee:
        raise AppException(
            "Employee not found",
            404,
        )

    return employee


@router.get("/{payroll_id}")
async def get_payslip(
    payroll_id: str,
    current_user: dict = Depends(get_current_user),
):
    employee = await get_employee_from_user(current_user)
    employee_id = employee["employee_id"]

    payslip_data = await service.get_payslip_data(
        payroll_id=payroll_id,
        employee_id=employee_id,
    )

    return {
        "success": True,
        "message": "Payslip details retrieved successfully",
        "data": payslip_data,
    }


@router.get("/{payroll_id}/download")
async def download_payslip(
    payroll_id: str,
):
    raise AppException(
        "Payslip PDF download has been disabled",
        410,
    )