from datetime import date, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from fastapi.responses import FileResponse

from app.api.deps import get_current_user, require_permission
from app.core.exceptions import AppException
from app.core.roles import Permission
from app.schemas.common import APIResponse
from app.schemas.employee_exit_request import (
    AdminExitRequestCreate,
    ExitRequestListResponse,
    ExitRequestResponse,
    ExitRequestSummary,
    ExitStatusUpdate,
)
from app.services.employee_exit_request_service import ExitRequestService

router = APIRouter(
    prefix="/admin/exit-requests",
    tags=["Admin Exit Requests"],
)

service = ExitRequestService()


async def require_exit_requests_read(
    current_user: dict = Depends(
        require_permission(Permission.EXIT_REQUESTS_READ)
    ),
):
    """Offboarding records are visible to any admin-level account.

    This used to be a hardcoded hr_admin role check, which contradicted
    ADMIN_PERMISSIONS (managers hold every permission) and dead-ended the Exit
    Requests nav item for managers.
    """
    return current_user


async def require_exit_requests_manage(
    current_user: dict = Depends(
        require_permission(Permission.EXIT_REQUESTS_MANAGE)
    ),
):
    """Actions that change an offboarding record: status, creation, deletion."""
    return current_user


@router.get("", response_model=APIResponse[ExitRequestListResponse])
async def list_exit_requests(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
    exit_type: str | None = Query(default=None),
    department_id: str | None = Query(default=None),
    submitted_from: datetime | None = Query(default=None),
    submitted_to: datetime | None = Query(default=None),
    search: str | None = Query(default=None, max_length=100),
    _: dict = Depends(require_exit_requests_read),
):
    data = await service.list_requests(
        page,
        limit,
        status=status,
        search=search,
        exit_type=exit_type,
        department_id=department_id,
        submitted_from=submitted_from,
        submitted_to=submitted_to,
    )
    return APIResponse(success=True, message="Exit requests fetched successfully", data=data)


# Declared before "/{request_id}" so "summary" is not treated as an ID.
@router.get("/summary", response_model=APIResponse[ExitRequestSummary])
async def exit_request_summary(
    exit_type: str | None = Query(default=None),
    _: dict = Depends(require_exit_requests_read),
):
    return APIResponse(
        success=True,
        message="Summary fetched successfully",
        data=await service.summary(exit_type),
    )


@router.post("", response_model=APIResponse[ExitRequestResponse])
async def create_exit_request(
    payload: AdminExitRequestCreate,
    _: dict = Depends(require_exit_requests_manage),
):
    document = await service.create_admin_request(payload)

    return APIResponse(
        success=True,
        message=f"{payload.exit_type} recorded successfully",
        data=service._serialize(document),
    )


@router.get("/{request_id}", response_model=APIResponse[ExitRequestResponse])
async def get_exit_request(
    request_id: str,
    _: dict = Depends(require_exit_requests_read),
):
    document = await service.get_request(request_id)
    return APIResponse(
        success=True,
        message="Exit request fetched successfully",
        data=service._serialize(document),
    )


@router.patch("/{request_id}/status", response_model=APIResponse[ExitRequestResponse])
async def update_exit_request_status(
    request_id: str,
    payload: ExitStatusUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_exit_requests_manage),
):
    reviewer = (
        current_user.get("full_name")
        or current_user.get("name")
        or current_user.get("email")
        or "HR"
    )
    document = await service.update_status(request_id, payload, reviewer)
    background_tasks.add_task(service.send_status_email, document)

    return APIResponse(
        success=True,
        message=f"Request marked as {document['status']}",
        data=service._serialize(document),
    )


@router.get("/{request_id}/attachments/{attachment_id}/download")
async def download_attachment(
    request_id: str,
    attachment_id: str,
    _: dict = Depends(require_exit_requests_read),
):
    document = await service.get_request(request_id)
    path, name, mime = service.get_attachment_file(document, attachment_id)
    return FileResponse(path=path, filename=name, media_type=mime)


@router.get("/{request_id}/documents/{document_key}/download")
async def download_exit_document(
    request_id: str,
    document_key: str,
    _: dict = Depends(require_exit_requests_read),
):
    document = await service.get_request(request_id)
    path, name, mime = service.get_document_file(document, document_key)
    return FileResponse(path=path, filename=name, media_type=mime)


# The service already implemented this and the admin page calls it, but the
# route was never wired up, so the delete button had nothing to hit. The service
# still refuses to delete anything that is not Pending or Cancelled.
@router.delete("/{request_id}", response_model=APIResponse[None])
async def delete_exit_request(
    request_id: str,
    _: dict = Depends(require_exit_requests_manage),
):
    await service.delete_request(request_id)

    return APIResponse(
        success=True,
        message="Exit request deleted successfully",
        data=None,
    )