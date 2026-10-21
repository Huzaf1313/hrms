from datetime import date, datetime

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, require_permission
from app.core.roles import Permission, has_permission
from app.schemas.common import APIResponse
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeCredentials,
    EmployeeResponse,
    EmployeeUpdate,
)
from app.services.employee_service import EmployeeService
from app.utils.pagination import PaginationParams
from app.core.exceptions import AppException


router = APIRouter()

service = EmployeeService()

def to_datetime(value: date | None) -> datetime | None:
    """Mongo/BSON only stores datetime, not bare date - convert before saving."""
    if value is None:
        return None

    return datetime(value.year, value.month, value.day)


def serialize_employee(employee: dict) -> EmployeeResponse:
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
        manager_id=employee.get("manager_id"),
        salary_structure=employee.get("salary_structure"),
        salary=employee.get("salary"),
        shift_id=employee.get("shift_id"),
        emergency_contact=employee.get("emergency_contact"),
        bank_information=employee.get("bank_information"),
        status=employee.get("status", "active"),
        created_by=employee.get("created_by"),
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

    employee, temporary_password = await service.create_employee(
        employee_data,
        current_user=current_user,
    )

    response = serialize_employee(employee)
    response.credentials = EmployeeCredentials(
        email=response.email,
        temporary_password=temporary_password,
    )

    return APIResponse(
        success=True,
        message="Employee created successfully",
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
        current_user=current_user,
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
    employee = await service.get_employee(
        employee_id=employee_id,
        current_user=current_user,
    )

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
        current_user=current_user,
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
    current_user: dict = Depends(
        require_permission(Permission.EMPLOYEES_UPDATE)
    ),
):
    employee = await service.deactivate_employee(
        employee_id=employee_id,
        current_user=current_user,
    )

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
    await service.delete_employee(
        employee_id=employee_id,
        current_user=current_user,
    )

    return APIResponse(
        success=True,
        message="Employee deleted successfully",
        data=None,
    )
