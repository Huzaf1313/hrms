from datetime import datetime

from app.core.exceptions import AppException
from app.repositories.department_repository import DepartmentRepository
from app.utils.filtering import build_filter
from app.utils.pagination import PaginationParams


class DepartmentService:
    def __init__(self):
        self.repository = DepartmentRepository()

    async def create_department(self, name: str, description: str | None = None):
        department_data = {
            "name": name,
            "description": description,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

        department = await self.repository.create(department_data)

        return department

    async def get_department(self, department_id: str):
        department = await self.repository.get_by_id(department_id)

        if not department:
            raise AppException("Department not found", 404)

        return department

    async def get_departments(
        self,
        name: str | None,
        pagination: PaginationParams,
    ):
        filters = build_filter({"name": name})

        return await self.repository.get_all(
            filters=filters,
            skip=pagination.skip,
            limit=pagination.limit,
        )

    async def update_department(
        self,
        department_id: str,
        name: str | None = None,
        description: str | None = None,
    ):
        department = await self.repository.get_by_id(department_id)

        if not department:
            raise AppException("Department not found", 404)

        update_data = {
            key: value
            for key, value in {
                "name": name,
                "description": description,
            }.items()
            if value is not None
        }

        update_data["updated_at"] = datetime.utcnow()

        return await self.repository.update(
            department_id,
            update_data,
        )

    async def delete_department(self, department_id: str):
        deleted = await self.repository.delete(department_id)

        if not deleted:
            raise AppException("Department not found", 404)

        return True