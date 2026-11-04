from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

class EmployeeDocumentModel(BaseModel):
    id: str | None = None

    employee_id: str
    document_name: str
    document_type: str

    file_url: str
    file_name: str
    file_size: int | None = None
    mime_type: str | None = None

    uploaded_by: str | None = None
    source: str | None = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    storage_key: Optional[str] = None