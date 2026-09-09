from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.core.exceptions import AppException
from app.repositories.employee_repository import EmployeeRepository
from app.services.employee_payroll_service import (
    EmployeePayrollService,
)


router = APIRouter(
    prefix="/employee-payroll",
    tags=["Employee Payroll"],
)

service = EmployeePayrollService()
employee_repository = EmployeeRepository()


async def get_employee_from_user(
    current_user: dict,
):
    email = current_user.get("email")

    if not email:
        raise AppException(
            "User email not found",
            401,
        )

    employee = await employee_repository.get_by_email(
        email
    )

    if not employee:
        raise AppException(
            "Employee not found",
            404,
        )

    return employee


@router.get("/employees/{employee_id}")
async def get_employee_payroll(
    employee_id: str,
    page: int = Query(
        default=1,
        ge=1,
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=100,
    ),
    current_user: dict = Depends(get_current_user),
):
    employee = await get_employee_from_user(
        current_user
    )

    if employee["employee_id"] != employee_id:
        raise AppException(
            "You are not authorized to access this payroll information",
            403,
        )

    data = await service.get_employee_payroll(
        employee_id=employee_id,
        page=page,
        limit=limit,
    )

    return {
        "success": True,
        "message": "Payroll records fetched successfully",
        "data": data,
    }


@router.get("/employees/{employee_id}/latest")
async def get_latest_payroll(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
):
    employee = await get_employee_from_user(
        current_user
    )

    if employee["employee_id"] != employee_id:
        raise AppException(
            "You are not authorized to access this payroll information",
            403,
        )

    data = await service.get_latest_payroll(
        employee_id=employee_id
    )

    return {
        "success": True,
        "message": "Latest payroll fetched successfully",
        "data": data,
    }


@router.get("/employees/{employee_id}/month/{month}")
async def get_payroll_by_month(
    employee_id: str,
    month: str,
    current_user: dict = Depends(get_current_user),
):
    employee = await get_employee_from_user(
        current_user
    )

    if employee["employee_id"] != employee_id:
        raise AppException(
            "You are not authorized to access this payroll information",
            403,
        )

    data = await service.get_payroll_by_month(
        employee_id=employee_id,
        month=month,
    )

    return {
        "success": True,
        "message": "Payroll record fetched successfully",
        "data": data,
    }


@router.get("/{payroll_id}")
async def get_payroll(
    payroll_id: str,
    current_user: dict = Depends(get_current_user),
):
    employee = await get_employee_from_user(
        current_user
    )

    data = await service.get_payroll(
        payroll_id=payroll_id,
        employee_id=employee["employee_id"],
    )

    return {
        "success": True,
        "message": "Payroll record fetched successfully",
        "data": data,
    }