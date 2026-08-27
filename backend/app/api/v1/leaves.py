from fastapi import APIRouter, Depends, Query

from app.api.deps import require_permission
from app.core.roles import Permission
from app.schemas.leave import (
    LeaveCreate,
    LeaveStatusUpdate,
)
from app.services.leave_service import LeaveService


router = APIRouter(
    prefix="/leaves",
)

service = LeaveService()


@router.get("/summary")
async def get_leave_summary(
    current_user: dict = Depends(require_permission(Permission.LEAVE_READ)),
):
    return {
        "success": True,
        "message": "Leave summary fetched successfully",
        "data": await service.get_summary(),
    }


@router.get("")
async def get_leaves(
    current_user: dict = Depends(require_permission(Permission.LEAVE_READ)),
    page: int = Query(
        default=1,
        ge=1,
    ),
    limit: int = Query(
        default=10,
        ge=1,
        le=100,
    ),
    status: str | None = None,
    employee_id: str | None = None,
    leave_type: str | None = None,
    department_id: str | None = None,
):
    data = await service.get_leaves(
        page=page,
        limit=limit,
        status=status,
        employee_id=employee_id,
        leave_type=leave_type,
        department_id=department_id,
    )

    return {
        "success": True,
        "message": "Leave requests fetched successfully",
        "data": data,
    }


@router.get("/{leave_id}")
async def get_leave(
    leave_id: str,
    current_user: dict = Depends(require_permission(Permission.LEAVE_READ)),
):
    return {
        "success": True,
        "message": "Leave request fetched successfully",
        "data": await service.get_leave(leave_id),
    }


@router.post("")
async def create_leave(
    payload: LeaveCreate,
    current_user: dict = Depends(require_permission(Permission.LEAVE_CREATE)),
):
    data = await service.create_leave(
        payload.model_dump()
    )

    return {
        "success": True,
        "message": "Leave request created successfully",
        "data": data,
    }


@router.patch("/{leave_id}/status")
async def update_leave_status(
    leave_id: str,
    payload: LeaveStatusUpdate,
    current_user: dict = Depends(require_permission(Permission.LEAVE_APPROVE)),
):
    data = await service.update_status(
        leave_id=leave_id,
        status=payload.status,
        admin_note=payload.admin_note,
        admin_user_id=str(current_user["_id"]),
    )

    return {
        "success": True,
        "message": "Leave status updated successfully",
        "data": data,
    }


@router.delete("/{leave_id}")
async def delete_leave(
    leave_id: str,
    current_user: dict = Depends(require_permission(Permission.LEAVE_UPDATE)),
):
    await service.delete_leave(leave_id)

    return {
        "success": True,
        "message": "Leave request deleted successfully",
        "data": None,
    }
