from datetime import date, datetime

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, require_permission
from app.core.roles import Permission, has_permission
from app.schemas.common import APIResponse
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeCredentials,
    EmployeeOTPRequest,
    EmployeeOTPRequestResponse,
    EmployeeOTPVerifyRequest,
    EmployeeOTPVerifyResponse,
    EmployeeResponse,
    EmployeeUpdate,
)
from app.services.employee_service import EmployeeService
from app.services.otp_service import OTPService
from app.utils.pagination import PaginationParams
from app.core.exceptions import AppException


router = APIRouter()

service = EmployeeService()
otp_service = OTPService()

def to_datetime(value: date | None) -> datetime | None:
    """Mongo/BSON only stores datetime, not bare date - convert before saving."""
    if value is None:
        return None

    return datetime(value.year, value.month, value.day)


def serialize_employee(
    employee: dict,
    welcome_email_sent: bool | None = None,
) -> EmployeeResponse:
    return EmployeeResponse(
        id=str(employee["_id"]),
        employee_id=employee.get("employee_id", ""),
        first_name=employee.get("first_name", ""),
        last_name=employee.get("last_name", ""),
        email=employee.get("email"),
        phone=employee.get("phone", ""),
        date_of_birth=employee.get("date_of_birth"),
        gender=employee.get("gender"),
        address=employee.get("address"),
        department_id=employee.get("department_id", ""),
        designation=employee.get("designation", ""),
        joining_date=employee.get("joining_date"),
        employment_type=employee.get("employment_type", "Full-time"),
        work_location=employee.get("work_location"),
        reporting_manager=employee.get("reporting_manager"),
        salary_structure=employee.get("salary_structure"),
        salary=employee.get("salary"),
        shift_id=employee.get("shift_id"),
        emergency_contact=employee.get("emergency_contact"),
        bank_information=employee.get("bank_information"),
        status=employee.get("status", "active"),
        created_by=employee.get("created_by"),
        welcome_email_sent=welcome_email_sent,
    )


@router.post(
    "/employees/request-email-otp",
    response_model=APIResponse[EmployeeOTPRequestResponse],
)
async def request_employee_email_otp(
    data: EmployeeOTPRequest,
    current_user: dict = Depends(require_permission(Permission.EMPLOYEES_CREATE)),
):
    result = await otp_service.create_employee_verification_otp(
        email=data.email,
        admin_id=str(current_user["_id"]),
    )

    return APIResponse(
        success=True,
        message=result["message"],
        data=EmployeeOTPRequestResponse(**result),
    )


@router.post(
    "/employees/verify-email-otp",
    response_model=APIResponse[EmployeeOTPVerifyResponse],
)
async def verify_employee_email_otp(
    data: EmployeeOTPVerifyRequest,
    current_user: dict = Depends(require_permission(Permission.EMPLOYEES_CREATE)),
):
    result = await otp_service.verify_employee_verification_otp(
        email=data.email,
        otp=data.otp,
        admin_id=str(current_user["_id"]),
    )

    return APIResponse(
        success=True,
        message=result["message"],
        data=EmployeeOTPVerifyResponse(**result),
    )


@router.post(
    "/employees",
    response_model=APIResponse[EmployeeResponse],
)
async def create_employee(
    data: EmployeeCreate,
    current_user: dict = Depends(require_permission(Permission.EMPLOYEES_CREATE)),
):
    employee_data = data.model_dump()
    employee_data["date_of_birth"] = to_datetime(employee_data.get("date_of_birth"))
    employee_data["joining_date"] = to_datetime(employee_data["joining_date"])

    employee, temporary_password, welcome_email_sent = await service.create_employee(
        employee_data,
        created_by=str(current_user["_id"]),
    )

    response = serialize_employee(employee, welcome_email_sent=welcome_email_sent)
    response.credentials = EmployeeCredentials(
        email=response.email,
        temporary_password=temporary_password,
    )

    message = (
        "Employee created successfully. Welcome email sent."
        if welcome_email_sent
        else "Employee created successfully (welcome email delivery failed)."
    )

    return APIResponse(
        success=True,
        message=message,
        data=response,
    )


@router.get(
    "/employees",
    response_model=APIResponse[list[EmployeeResponse]],
)
async def get_employees(
    search: str | None = Query(default=None),
    department_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_permission(Permission.EMPLOYEES_READ)),
):
    pagination = PaginationParams(page=page, limit=limit)

    employees = await service.get_employees(
        search=search,
        department_id=department_id,
        status=status,
        pagination=pagination,
    )

    return APIResponse(
        success=True,
        message="Employees retrieved successfully",
        data=[serialize_employee(employee) for employee in employees],
    )

@router.get(
    "/employees/me",
    response_model=APIResponse[EmployeeResponse],
)
async def get_my_employee_profile(
    current_user: dict = Depends(get_current_user),
):
    if not current_user.get("employee_id"):
        raise AppException(
            "Employee profile not found",
            404,
        )

    return APIResponse(
        success=True,
        message="Employee profile retrieved successfully",
        data=serialize_employee(current_user),
    )

@router.get(
    "/employees/{employee_id}",
    response_model=APIResponse[EmployeeResponse],
)
async def get_employee(
    employee_id: str,
    current_user: dict = Depends(require_permission(Permission.EMPLOYEES_READ)),
):
    employee = await service.get_employee(employee_id)

    return APIResponse(
        success=True,
        message="Employee retrieved successfully",
        data=serialize_employee(employee),
    )


@router.put(
    "/employees/{employee_id}",
    response_model=APIResponse[EmployeeResponse],
)
async def update_employee(
    employee_id: str,
    data: EmployeeUpdate,
    current_user: dict = Depends(get_current_user),
):
    print("🔥 UPDATE EMPLOYEE ENDPOINT HIT")
    print("Current user:", current_user)
    print("Employee ID from URL:", employee_id)

    role = current_user.get("role")
    current_user_id = current_user.get("_id")

    # Employee users can only update their own emergency contact
    if role == "employee":
        current_user_id = current_user.get("_id")

        if not current_user_id:
            raise AppException(
                "Employee profile not found",
                404,
            )

        if str(current_user_id) != str(employee_id):
            raise AppException(
                "You can only update your own employee profile",
                403,
            )

        update_data = data.model_dump(exclude_unset=True)

        allowed_fields = {"emergency_contact"}

        if not set(update_data).issubset(allowed_fields):
            raise AppException(
                "Employees can only update emergency contact details",
                403,
            )

    # HR/Admin/Manager continue using normal permissions
    else:
        if not has_permission(role, Permission.EMPLOYEES_UPDATE):
            raise AppException(
                "You do not have permission to perform this action",
                403,
            )

        update_data = data.model_dump()

        update_data["date_of_birth"] = to_datetime(
            update_data.get("date_of_birth")
        )

        update_data["joining_date"] = to_datetime(
            update_data.get("joining_date")
        )

    employee = await service.update_employee(
        employee_id=employee_id,
        update_data=update_data,
    )

    return APIResponse(
        success=True,
        message="Employee updated successfully",
        data=serialize_employee(employee),
    )


@router.patch(
    "/employees/{employee_id}/deactivate",
    response_model=APIResponse[EmployeeResponse],
)
async def deactivate_employee(
    employee_id: str,
    current_user: dict = Depends(require_permission(Permission.EMPLOYEES_UPDATE)),
):
    employee = await service.deactivate_employee(employee_id)

    return APIResponse(
        success=True,
        message="Employee deactivated successfully",
        data=serialize_employee(employee),
    )


@router.delete(
    "/employees/{employee_id}",
    response_model=APIResponse[None],
)
async def delete_employee(
    employee_id: str,
    current_user: dict = Depends(require_permission(Permission.EMPLOYEES_DELETE)),
):
    await service.delete_employee(employee_id)

    return APIResponse(
        success=True,
        message="Employee deleted successfully",
        data=None,
    )