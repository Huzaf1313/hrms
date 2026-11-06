import asyncio
import os
from pathlib import Path
from urllib.parse import quote

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Query,
    UploadFile,
)
from fastapi.responses import FileResponse, StreamingResponse
from botocore.exceptions import BotoCoreError, ClientError

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.exceptions import AppException
from app.repositories.employee_repository import EmployeeRepository
from app.schemas.common import APIResponse
from app.schemas.employee_document import (
    EmployeeDocumentResponse,
    EmployeeDocumentsResponse,
)
from app.services.employee_document_service import EmployeeDocumentService
from app.services.employee_cloudflare_r2_service import CloudflareR2Service
from app.utils.employee_storage import employee_document_key
from app.services.object_storage_service import content_type_for

router = APIRouter(
    prefix="/employee-documents",
    tags=["Employee Documents"],
)

service = EmployeeDocumentService()
employee_repository = EmployeeRepository()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
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
    employee_id: str | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    role = current_user.get("role")
    if role in {"hr_admin", "manager"}:
        employee_id = employee_id or current_user.get("employee_id")
    else:
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
    employee_id: str | None = Form(default=None),
    current_user: dict = Depends(get_current_user),
):
    role = current_user.get("role")
    if role not in {"employee", "hr_admin", "manager"}:
        raise AppException(
            "Only employees and HR admins can upload documents",
            403,
        )

    employee_id = employee_id if role == "hr_admin" else current_user.get("employee_id")

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
            "PDF, image, Word, and Excel documents are supported",
            400,
        )

    # Read at most one byte above the limit to enforce the size cap.
    contents = await file.read(MAX_FILE_SIZE + 1)
    await file.close()

    if not contents:
        raise AppException("The selected file is empty", 400)

    signatures = {
        ".pdf": contents.startswith(b"%PDF"),
        ".jpg": contents.startswith(b"\xff\xd8\xff"),
        ".jpeg": contents.startswith(b"\xff\xd8\xff"),
        ".png": contents.startswith(b"\x89PNG\r\n\x1a\n"),
        ".webp": contents.startswith(b"RIFF") and contents[8:12] == b"WEBP",
    }
    if extension in signatures and not signatures[extension]:
        raise AppException("The selected file is not a valid document", 400)

    if len(contents) > MAX_FILE_SIZE:
        raise AppException(
            "File size must not exceed 10 MB",
            413,
        )

    target_employee = await employee_repository.get_by_employee_id(employee_id)
    if not target_employee:
        raise AppException("Employee profile not found", 404)

    base_file_name = employee_document_key(
        target_employee,
        document_name,
        extension,
    ).rsplit("/", 1)[-1]
    file_name = base_file_name
    duplicate_suffix = 1

    existing_documents = await service.get_employee_documents(employee_id)
    existing_file_names = {
        document.get("file_name")
        for document in existing_documents
        if document.get("file_name")
    }

    while file_name in existing_file_names:
        storage_name = employee_document_key(
            target_employee,
            document_name,
            extension,
            suffix=duplicate_suffix,
        )
        file_name = storage_name.rsplit("/", 1)[-1]
        duplicate_suffix += 1

    display_file_name = file_name
    mime_type = content_type_for(display_file_name, file.content_type)
    storage_key = employee_document_key(
        target_employee,
        document_name,
        extension,
        suffix=(duplicate_suffix - 1 if file_name != base_file_name else None),
    )

    source = "hr_admin" if role in {"hr_admin", "manager"} else "employee"
    uploader = (
        current_user.get("full_name")
        or current_user.get("name")
        or current_user.get("email")
        or str(current_user.get("_id", ""))
    )

    storage = None
    r2_uploaded = False
    document_id = None

    try:
        storage = CloudflareR2Service()

        # Boto3 is synchronous, so run its network operation in a thread.
        await asyncio.to_thread(
            storage.upload_file,
            storage_key,
            contents,
            mime_type,
        )
        r2_uploaded = True

        document = await service.create_document(
            {
                "employee_id": employee_id,
                "document_name": document_name,
                "document_type": document_type,
                "file_url": "",
                "file_name": display_file_name,
                "file_size": len(contents),
                "mime_type": mime_type,
                "uploaded_by": uploader,
                "source": source,
                "storage_key": storage_key,
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
        # Remove the database record if it was created but not completed.
        if document_id:
            try:
                await service.delete_document(document_id)
            except Exception:
                pass

        # Remove the R2 object if the database operation failed.
        if r2_uploaded and storage:
            try:
                await asyncio.to_thread(
                    storage.delete_file,
                    storage_key,
                )
            except Exception:
                pass

        raise


async def _get_document_file_response(
    document: dict,
    disposition: str,
):
    filename = document.get("file_name") or "document"
    mime_type = (
        document.get("mime_type")
        or "application/octet-stream"
    )

    storage_key = document.get("storage_key")

    # New documents are retrieved from private Cloudflare R2 storage.
    if storage_key:
        try:
            storage = CloudflareR2Service()

            result = await asyncio.to_thread(
                storage.get_file,
                storage_key,
            )

            body = result["Body"]

        except ClientError as exc:
            error_code = exc.response.get(
                "Error", {}
            ).get("Code")

            if error_code in {"NoSuchKey", "404", "NotFound"}:
                raise AppException(
                    "Document file not found",
                    404,
                ) from exc

            raise AppException(
                "Unable to retrieve document from storage",
                502,
            ) from exc

        except (BotoCoreError, RuntimeError) as exc:
            raise AppException(
                "Document storage is temporarily unavailable",
                502,
            ) from exc

        async def stream_r2_file():
            try:
                while True:
                    chunk = await asyncio.to_thread(
                        body.read,
                        1024 * 1024,
                    )

                    if not chunk:
                        break

                    yield chunk

            finally:
                await asyncio.to_thread(body.close)

        return StreamingResponse(
            stream_r2_file(),
            media_type=mime_type,
            headers={
                "Content-Disposition": (
                    f"{disposition}; "
                    f"filename*=UTF-8''{quote(filename)}"
                ),
                "Cache-Control": "private, no-store",
            },
        )

    # Legacy documents continue using private local storage.
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
        media_type=(
            document.get("mime_type")
            or "application/octet-stream"
        ),
        headers={
            "Content-Disposition": (
                f"{disposition}; "
                f"filename*=UTF-8''{quote(filename)}"
            ),
            "Cache-Control": "private, no-store",
        },
    )


async def _authorize_document(document_id: str, current_user: dict):
    document = await service.get_document(document_id)

    role = current_user.get("role")
    is_hr_or_manager = role in {"hr_admin", "manager"}
    is_owner = current_user.get("employee_id") == document.get("employee_id")

    if not is_hr_or_manager and not is_owner:
        raise AppException("Document not found", 404)

    return document


@router.get("/{document_id}/download")
async def download_employee_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    document = await _authorize_document(document_id, current_user)
    return await _get_document_file_response(document, "attachment")


@router.get("/{document_id}/preview")
async def preview_employee_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    document = await _authorize_document(document_id, current_user)
    return await _get_document_file_response(document, "inline")

@router.delete(
    "/{document_id}",
    response_model=APIResponse[None],
)
async def delete_employee_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    document = await service.get_document(document_id)

    role = current_user.get("role")
    is_admin = role in {"hr_admin", "manager"}
    is_owner = (
        current_user.get("employee_id") == document.get("employee_id")
        and document.get("source") in {"employee", "employee_upload"}
    )

    if not is_admin and not is_owner:
        raise AppException("Document not found", 404)

    await service.delete_document(document_id)

    return APIResponse(
        success=True,
        message="Document deleted successfully",
        data=None,
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
