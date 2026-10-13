from fastapi import APIRouter, BackgroundTasks, Depends, Query
from fastapi.responses import FileResponse

from app.api.deps import get_current_user
from app.core.exceptions import AppException
from app.schemas.common import APIResponse
from app.schemas.employee_exit_request import (
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


async def require_hr_admin(current_user: dict = Depends(get_current_user)):
    # HR only: managers are admins in roles.py but should not review resignations.
    if current_user.get("role") != "hr_admin":
        raise AppException("Only HR can manage exit requests", 403)
    return current_user


@router.get("", response_model=APIResponse[ExitRequestListResponse])
async def list_exit_requests(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
    search: str | None = Query(default=None, max_length=100),
    _: dict = Depends(require_hr_admin),
):
    data = await service.list_requests(page, limit, status=status, search=search)
    return APIResponse(success=True, message="Exit requests fetched successfully", data=data)


# Declared before "/{request_id}" so "summary" is not treated as an ID.
@router.get("/summary", response_model=APIResponse[ExitRequestSummary])
async def exit_request_summary(_: dict = Depends(require_hr_admin)):
    return APIResponse(
        success=True,
        message="Summary fetched successfully",
        data=await service.summary(),
    )


@router.get("/{request_id}", response_model=APIResponse[ExitRequestResponse])
async def get_exit_request(request_id: str, _: dict = Depends(require_hr_admin)):
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
    current_user: dict = Depends(require_hr_admin),
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
    _: dict = Depends(require_hr_admin),
):
    document = await service.get_request(request_id)
    path, name, mime = service.get_attachment_file(document, attachment_id)
    return FileResponse(path=path, filename=name, media_type=mime)


@router.get("/{request_id}/documents/{document_key}/download")
async def download_exit_document(
    request_id: str,
    document_key: str,
    _: dict = Depends(require_hr_admin),
):
    document = await service.get_request(request_id)
    path, name, mime = service.get_document_file(document, document_key)
    return FileResponse(path=path, filename=name, media_type=mime)