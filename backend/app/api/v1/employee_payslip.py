from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

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


@router.get("/{payroll_id}/download")
async def download_payslip(
    payroll_id: str,
    current_user: dict = Depends(get_current_user),
):
    employee = await get_employee_from_user(current_user)
    employee_id = employee["employee_id"]

    # Validate the payroll belongs to the logged-in employee
    payslip_data = await service.get_payslip_data(
        payroll_id=payroll_id,
        employee_id=employee_id,
    )

    # Generate the PDF
    pdf_buffer = await service.generate_payslip_pdf(
        payroll_id=payroll_id,
        employee_id=employee_id,
    )

    payroll = payslip_data["payroll"]

    # Build filename from the logged-in employee's actual name
    employee_name = " ".join(
        filter(
            None,
            [
                employee.get("first_name"),
                employee.get("last_name"),
            ],
        )
    ).strip()

    if not employee_name:
        employee_name = employee_id

    # Convert employee name to a filename-safe format
    employee_name = "_".join(employee_name.split())

    # Use the month stored in the actual payroll record
    payroll_month = str(
        payroll.get("month") or "Payslip"
    ).strip()

    payroll_month = "_".join(payroll_month.split())

    filename = (
        f"{employee_name}_Payslip_{payroll_month}.pdf"
    )

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            )
        },
    )