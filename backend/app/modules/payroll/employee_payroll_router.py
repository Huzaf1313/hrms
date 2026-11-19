from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.core.cache import get_cache, set_cache
from app.core.exceptions import AppException
from app.repositories.employee_repository import EmployeeRepository
from app.modules.payroll.employee_payroll_service import (
    EmployeePayrollService,
)

EMPLOYEE_PAYROLL_LIST_TTL = 180
EMPLOYEE_PAYROLL_DETAIL_TTL = 300

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

    page_val = page if isinstance(page, int) else 1
    limit_val = limit if isinstance(limit, int) else 100
    cache_key = f"payroll:emp:{employee_id}:list:{page_val}:{limit_val}"

    cached = await get_cache(cache_key)
    if cached is not None:
        return {
            "success": True,
            "message": "Payroll records fetched successfully",
            "data": cached,
        }

    data = await service.get_employee_payroll(
        employee_id=employee_id,
        page=page_val,
        limit=limit_val,
    )

    await set_cache(cache_key, data, ttl=EMPLOYEE_PAYROLL_LIST_TTL)

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

    cache_key = f"payroll:emp:{employee_id}:latest"
    cached = await get_cache(cache_key)
    if cached is not None:
        return {
            "success": True,
            "message": "Latest payroll fetched successfully",
            "data": cached,
        }

    data = await service.get_latest_payroll(
        employee_id=employee_id
    )

    await set_cache(cache_key, data, ttl=EMPLOYEE_PAYROLL_LIST_TTL)

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

    month_str = month.strip().lower() if isinstance(month, str) else str(month)
    cache_key = f"payroll:emp:{employee_id}:month:{month_str}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return {
            "success": True,
            "message": "Payroll record fetched successfully",
            "data": cached,
        }

    data = await service.get_payroll_by_month(
        employee_id=employee_id,
        month=month,
    )

    await set_cache(cache_key, data, ttl=EMPLOYEE_PAYROLL_DETAIL_TTL)

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
    employee_id = employee["employee_id"]

    cache_key = f"payroll:emp:{employee_id}:record:{payroll_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return {
            "success": True,
            "message": "Payroll record fetched successfully",
            "data": cached,
        }

    data = await service.get_payroll(
        payroll_id=payroll_id,
        employee_id=employee_id,
    )

    await set_cache(cache_key, data, ttl=EMPLOYEE_PAYROLL_DETAIL_TTL)

    return {
        "success": True,
        "message": "Payroll record fetched successfully",
        "data": data,
    }