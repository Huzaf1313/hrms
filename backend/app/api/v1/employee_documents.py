
import mimetypes
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.exceptions import AppException
from app.schemas.common import APIResponse
from app.schemas.employee_document import (
    EmployeeDocumentResponse,
    EmployeeDocumentsResponse,
)
from app.services.employee_document_service import EmployeeDocumentService


router = APIRouter(
    prefix="/employee-documents",
    tags=["Employee Documents"],
)

service = EmployeeDocumentService()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
}


def serialize_document(document: dict) -> EmployeeDocumentResponse:
    return EmployeeDocumentResponse(
        id=str(document["_id"]),
        employee_id=document.get("employee_id", ""),
        document_name=document.get("document_name", ""),
        document_type=document.get("document_type", ""),
        file_url=document.get("file_url", ""),
        file_name=document.get("file_name", ""),
        file_size=document.get("file_size"),
        mime_type=document.get("mime_type"),
        uploaded_by=document.get("uploaded_by"),
        source=document.get("source"),
        created_at=document["created_at"],
        updated_at=document["updated_at"],
    )


@router.get("", response_model=APIResponse[EmployeeDocumentsResponse])
async def get_my_documents(
    search: str | None = Query(default=None),
    document_type: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    employee_id = current_user.get("employee_id")

    if not employee_id:
        return APIResponse(
            success=True,
            message="No employee documents found",
            data=EmployeeDocumentsResponse(
                documents=[],
                summary={
                    "total_documents": 0,
                    "categories": {},
                },
            ),
        )

    documents = await service.get_employee_documents(
        employee_id,
        search=search,
        document_type=document_type,
    )

    summary = await service.get_employee_document_summary(employee_id)

    return APIResponse(
        success=True,
        message="Employee documents retrieved successfully",
        data=EmployeeDocumentsResponse(
            documents=[
                serialize_document(document)
                for document in documents
            ],
            summary=summary,
        ),
    )


@router.post(
    "",
    response_model=APIResponse[EmployeeDocumentResponse],
)
async def upload_my_document(
    document_name: str = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    # This endpoint is specifically for employee self-service uploads.
    if current_user.get("role") != "employee":
        raise AppException(
            "This upload endpoint is for employees only",
            403,
        )

    employee_id = current_user.get("employee_id")

    if not employee_id:
        raise AppException(
            "Employee profile not found",
            404,
        )

    document_name = document_name.strip()
    document_type = document_type.strip()

    if not document_name or len(document_name) > 150:
        raise AppException(
            "Document name must be between 1 and 150 characters",
            400,
        )

    if not document_type or len(document_type) > 80:
        raise AppException(
            "Please provide a valid document category",
            400,
        )

    original_name = Path(file.filename or "").name

    if not original_name:
        raise AppException("Please select a file", 400)

    extension = Path(original_name).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise AppException(
            "Unsupported file type. Upload PDF, image, Word, or Excel files",
            400,
        )

    # Read at most one byte above the limit to enforce the size cap.
    contents = await file.read(MAX_FILE_SIZE + 1)
    await file.close()

    if not contents:
        raise AppException("The selected file is empty", 400)

    if len(contents) > MAX_FILE_SIZE:
        raise AppException(
            "File size must not exceed 10 MB",
            413,
        )

    private_dir = os.path.abspath(settings.PRIVATE_UPLOAD_DIR)
    os.makedirs(private_dir, exist_ok=True)

    stored_name = f"{uuid.uuid4().hex}{extension}"
    file_path = os.path.join(private_dir, stored_name)

    mime_type = (
        file.content_type
        or mimetypes.guess_type(original_name)[0]
        or "application/octet-stream"
    )

    try:
        with open(file_path, "wb") as output:
            output.write(contents)

        document = await service.create_document(
            {
                "employee_id": employee_id,
                "document_name": document_name,
                "document_type": document_type,
                "file_url": "",
                "file_name": original_name,
                "file_size": len(contents),
                "mime_type": mime_type,
                "uploaded_by": (
                    current_user.get("full_name")
                    or current_user.get("name")
                    or current_user.get("email")
                    or str(current_user.get("_id", ""))
                ),
                "source": "employee_upload",
                "storage_path": file_path,
            }
        )

        document_id = str(document["_id"])

        document = await service.update_document(
            document_id,
            {
                "file_url": (
                    f"/employee-documents/{document_id}/download"
                )
            },
        )

        return APIResponse(
            success=True,
            message="Document uploaded successfully",
            data=serialize_document(document),
        )

    except Exception:
        # Avoid leaving an orphaned file if saving the record fails.
        if os.path.isfile(file_path):
            os.remove(file_path)
        raise


@router.get("/{document_id}/download")
async def download_employee_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    document = await service.get_document(document_id)

    role = current_user.get("role")
    is_hr_or_manager = role in {"hr_admin", "manager"}
    is_owner = (
        current_user.get("employee_id")
        == document.get("employee_id")
    )

    if not is_hr_or_manager and not is_owner:
        raise AppException("Document not found", 404)

    storage_path = document.get("storage_path")

    if not storage_path:
        raise AppException(
            "This document does not have a private file attached",
            404,
        )

    private_dir = os.path.abspath(settings.PRIVATE_UPLOAD_DIR)
    file_path = os.path.abspath(storage_path)

    # Ensure the saved path cannot escape the private storage directory.
    try:
        is_inside_private_dir = (
            os.path.commonpath([private_dir, file_path])
            == private_dir
        )
    except ValueError:
        is_inside_private_dir = False

    if not is_inside_private_dir or not os.path.isfile(file_path):
        raise AppException("Document file not found", 404)

    return FileResponse(
        path=file_path,
        filename=document.get("file_name") or "document",
        media_type=(
            document.get("mime_type")
            or "application/octet-stream"
        ),
    )


@router.get(
    "/{document_id}",
    response_model=APIResponse[EmployeeDocumentResponse],
)
async def get_my_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    employee_id = current_user.get("employee_id")
    document = await service.get_document(document_id)

    if document.get("employee_id") != employee_id:
        raise AppException("Document not found", 404)

    return APIResponse(
        success=True,
        message="Employee document retrieved successfully",
        data=serialize_document(document),
    )