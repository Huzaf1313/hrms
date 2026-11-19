import json

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    Query,
    UploadFile,
)
from fastapi.responses import FileResponse
from pydantic import ValidationError

from app.api.deps import get_current_user
from app.core.exceptions import AppException
from app.core.common_schemas import APIResponse
from app.modules.exit.schemas import (
    ExitRequestCreate,
    ExitRequestListResponse,
    ExitRequestResponse,
)
from app.modules.exit.service import ExitRequestService

router = APIRouter(
    prefix="/employee-exit-requests",
    tags=["Employee Exit Requests"],
)

service = ExitRequestService()


def require_employee_id(current_user: dict) -> str:
    employee_id = current_user.get("employee_id")
    if not employee_id:
        raise AppException("Employee profile not found", 404)
    return employee_id


@router.post("", response_model=APIResponse[ExitRequestResponse])
async def submit_resignation(
    background_tasks: BackgroundTasks,
    last_working_day: str = Form(""),
    notice_period_days: int = Form(0),
    reason: str = Form(""),
    remarks: str = Form(""),
    handover_tasks: str = Form("[]"),
    confirmed: bool = Form(False),
    files: list[UploadFile] = File(default=[]),
    current_user: dict = Depends(get_current_user),
):
    require_employee_id(current_user)

    try:
        tasks = json.loads(handover_tasks or "[]")
        if not isinstance(tasks, list):
            raise ValueError
    except ValueError:
        raise AppException("Handover tasks are invalid", 400)

    try:
        payload = ExitRequestCreate(
            last_working_day=last_working_day,
            notice_period_days=notice_period_days,
            reason=reason,
            remarks=remarks.strip() or None,
            handover_tasks=tasks,
            confirmed=confirmed,
        )
    except ValidationError as exc:
        first = exc.errors()[0]
        field = ".".join(str(part) for part in first["loc"])
        raise AppException(f"Invalid {field}: {first['msg']}", 400)

    prepared_files = await service.read_attachments(files)
    created = await service.create_request(current_user, payload, prepared_files)

    hr_emails = await service.get_hr_emails()
    background_tasks.add_task(service.send_submitted_email, created, hr_emails)

    return APIResponse(
        success=True,
        message="Resignation submitted successfully",
        data=service._serialize(created),
    )


@router.get("", response_model=APIResponse[ExitRequestListResponse])
async def list_my_exit_requests(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    employee_id = require_employee_id(current_user)
    data = await service.list_requests(page, limit, employee_id=employee_id, status=status)
    return APIResponse(success=True, message="Exit requests fetched successfully", data=data)


@router.get("/{request_id}", response_model=APIResponse[ExitRequestResponse])
async def get_my_exit_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
):
    employee_id = require_employee_id(current_user)
    document = await service.get_request(request_id, employee_id)
    return APIResponse(
        success=True,
        message="Exit request fetched successfully",
        data=service._serialize(document),
    )


@router.patch("/{request_id}/cancel", response_model=APIResponse[ExitRequestResponse])
async def cancel_my_exit_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
):
    employee_id = require_employee_id(current_user)
    document = await service.cancel_request(request_id, employee_id)
    return APIResponse(
        success=True,
        message="Exit request cancelled successfully",
        data=service._serialize(document),
    )


@router.post(
    "/{request_id}/documents/{document_key}",
    response_model=APIResponse[ExitRequestResponse],
)
async def upload_exit_document(
    request_id: str,
    document_key: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    employee_id = require_employee_id(current_user)
    updated = await service.upload_document(request_id, employee_id, document_key, file)
    return APIResponse(
        success=True,
        message="Document uploaded successfully",
        data=service._serialize(updated),
    )


@router.get("/{request_id}/documents/{document_key}/download")
async def download_my_document(
    request_id: str,
    document_key: str,
    current_user: dict = Depends(get_current_user),
):
    employee_id = require_employee_id(current_user)
    document = await service.get_request(request_id, employee_id)
    path, name, mime = service.get_document_file(document, document_key)
    return FileResponse(path=path, filename=name, media_type=mime)


@router.get("/{request_id}/attachments/{attachment_id}/download")
async def download_my_attachment(
    request_id: str,
    attachment_id: str,
    current_user: dict = Depends(get_current_user),
):
    employee_id = require_employee_id(current_user)
    document = await service.get_request(request_id, employee_id)
    path, name, mime = service.get_attachment_file(document, attachment_id)
    return FileResponse(path=path, filename=name, media_type=mime)