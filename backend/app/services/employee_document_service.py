from datetime import datetime

from app.core.exceptions import AppException
from app.repositories.employee_document_repository import (
    EmployeeDocumentRepository,
)


class EmployeeDocumentService:
    def __init__(self):
        self.repository = EmployeeDocumentRepository()

    async def create_document(self, document_data: dict):
        document_data["created_at"] = datetime.utcnow()
        document_data["updated_at"] = datetime.utcnow()

        document = await self.repository.create(document_data)

        return document

    async def get_document(self, document_id: str):
        document = await self.repository.get_by_id(document_id)

        if not document:
            raise AppException(
                "Document not found",
                404,
            )

        return document

    async def get_employee_documents(
        self,
        employee_id: str,
        search: str | None = None,
        document_type: str | None = None,
    ):
        return await self.repository.get_by_employee_id(
            employee_id,
            search=search,
            document_type=document_type,
        )

    async def get_employee_document_summary(self, employee_id: str):
        return await self.repository.get_summary_by_employee_id(
            employee_id
        )

    async def update_document(
        self,
        document_id: str,
        update_data: dict,
    ):
        document = await self.repository.get_by_id(document_id)

        if not document:
            raise AppException(
                "Document not found",
                404,
            )

        update_data = {
            key: value
            for key, value in update_data.items()
            if value is not None
        }

        update_data["updated_at"] = datetime.utcnow()

        return await self.repository.update(
            document_id,
            update_data,
        )

    async def delete_document(self, document_id: str):
        document = await self.repository.get_by_id(document_id)

        if not document:
            raise AppException(
                "Document not found",
                404,
            )

        deleted = await self.repository.delete(document_id)

        if not deleted:
            raise AppException(
                "Document not found",
                404,
            )

        return True