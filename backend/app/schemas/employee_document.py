from datetime import datetime
from typing import Any

from pydantic import BaseModel


class EmployeeDocumentCreate(BaseModel):
    employee_id: str
    document_name: str
    document_type: str
    file_url: str
    file_name: str
    file_size: int | None = None
    mime_type: str | None = None


class EmployeeDocumentResponse(BaseModel):
    id: str
    employee_id: str
    document_name: str
    document_type: str
    file_url: str
    file_name: str
    file_size: int | None = None
    mime_type: str | None = None
    uploaded_by: str | None = None
    created_at: Any
    updated_at: Any


class EmployeeDocumentSummary(BaseModel):
    total_documents: int
    categories: dict[str, int]


class EmployeeDocumentsResponse(BaseModel):
    documents: list[EmployeeDocumentResponse]
    summary: EmployeeDocumentSummary