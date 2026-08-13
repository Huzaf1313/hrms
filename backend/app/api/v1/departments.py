from fastapi import APIRouter, Query

from app.schemas.common import APIResponse
from app.schemas.department import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
)
from app.services.department_service import DepartmentService
from app.utils.pagination import PaginationParams


router = APIRouter()

service = DepartmentService()


def serialize_department(department: dict) -> DepartmentResponse:
    return DepartmentResponse(
        id=str(department["_id"]),
        name=department["name"],
        description=department.get("description"),
    )


@router.post(
    "/departments",
    response_model=APIResponse[DepartmentResponse],
)
async def create_department(data: DepartmentCreate):
    department = await service.create_department(
        name=data.name,
        description=data.description,
    )

    return APIResponse(
        success=True,
        message="Department created successfully",
        data=serialize_department(department),
    )


@router.get(
    "/departments",
    response_model=APIResponse[list[DepartmentResponse]],
)
async def get_departments(
    name: str | None = Query(default=None),
    pagination: PaginationParams = None,
):
    if pagination is None:
        pagination = PaginationParams()

    departments = await service.get_departments(
        name=name,
        pagination=pagination,
    )

    return APIResponse(
        success=True,
        message="Departments retrieved successfully",
        data=[serialize_department(dept) for dept in departments],
    )


@router.get(
    "/departments/{department_id}",
    response_model=APIResponse[DepartmentResponse],
)
async def get_department(department_id: str):
    department = await service.get_department(department_id)

    return APIResponse(
        success=True,
        message="Department retrieved successfully",
        data=serialize_department(department),
    )


@router.put(
    "/departments/{department_id}",
    response_model=APIResponse[DepartmentResponse],
)
async def update_department(
    department_id: str,
    data: DepartmentUpdate,
):
    department = await service.update_department(
        department_id=department_id,
        name=data.name,
        description=data.description,
    )

    return APIResponse(
        success=True,
        message="Department updated successfully",
        data=serialize_department(department),
    )


@router.delete(
    "/departments/{department_id}",
    response_model=APIResponse[None],
)
async def delete_department(department_id: str):
    await service.delete_department(department_id)

    return APIResponse(
        success=True,
        message="Department deleted successfully",
        data=None,
    )