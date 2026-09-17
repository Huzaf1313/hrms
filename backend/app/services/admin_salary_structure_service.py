from app.core.exceptions import AppException
from app.repositories.admin_salary_structure_repository import (
    AdminSalaryStructureRepository,
)
from app.schemas.admin_salary_structure import AdminSalaryStructureResponse


class AdminSalaryStructureService:
    def __init__(self):
        self.repository = AdminSalaryStructureRepository()

    def _serialize(self, structure: dict) -> AdminSalaryStructureResponse:
        earnings = structure.get("earnings", [])
        gross_salary = sum(earning["amount"] for earning in earnings)

        return AdminSalaryStructureResponse(
            id=str(structure["_id"]),
            name=structure.get("name", ""),
            range=structure.get("range", ""),
            earnings=earnings,
            gross_salary=gross_salary,
        )

    async def create_structure(self, data: dict):
        structure = await self.repository.create(data)

        return self._serialize(structure)

    async def get_structure(self, structure_id: str):
        structure = await self.repository.get_by_id(structure_id)

        if not structure:
            raise AppException("Salary structure not found", 404)

        return self._serialize(structure)

    async def get_all_structures(self, skip: int = 0, limit: int = 100):
        structures = await self.repository.get_all(
            filters={},
            skip=skip,
            limit=limit,
        )

        return [self._serialize(structure) for structure in structures]

    async def update_structure(self, structure_id: str, update_data: dict):
        existing = await self.repository.get_by_id(structure_id)

        if not existing:
            raise AppException("Salary structure not found", 404)

        update_data = {
            key: value
            for key, value in update_data.items()
            if value is not None
        }

        updated = await self.repository.update(structure_id, update_data)

        return self._serialize(updated)

    async def delete_structure(self, structure_id: str):
        deleted = await self.repository.delete(structure_id)

        if not deleted:
            raise AppException("Salary structure not found", 404)

        return True