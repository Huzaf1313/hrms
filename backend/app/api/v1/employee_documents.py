from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
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
        created_at=document["created_at"],
        updated_at=document["updated_at"],
    )


@router.get(
    "",
    response_model=APIResponse[EmployeeDocumentsResponse],
)
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

    summary = await service.get_employee_document_summary(
        employee_id
    )

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
        from app.core.exceptions import AppException

        raise AppException(
            "Document not found",
            404,
        )

    return APIResponse(
        success=True,
        message="Employee document retrieved successfully",
        data=serialize_document(document),
    )