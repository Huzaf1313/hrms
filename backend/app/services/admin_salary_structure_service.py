import re

from app.core.exceptions import AppException
from app.repositories.admin_salary_structure_repository import (
    AdminSalaryStructureRepository,
)
from app.schemas.admin_salary_structure import AdminSalaryStructureResponse


def parse_salary_floor(range_text: str | None) -> float | None:
    """Derive a minimum from the free-text range, e.g. '12000' or '12,000 - 20,000'."""
    if not range_text:
        return None

    match = re.search(r"\d[\d,]*", str(range_text))

    if not match:
        return None

    value = float(match.group(0).replace(",", ""))

    return value if value > 0 else None


def validate_salary_band(
    min_salary: float | None,
    max_salary: float | None,
):
    if min_salary is None or max_salary is None:
        return

    if max_salary < min_salary:
        raise AppException(
            "Maximum salary cannot be lower than the minimum salary",
            400,
        )


class AdminSalaryStructureService:
    def __init__(self):
        self.repository = AdminSalaryStructureRepository()

    def _serialize(self, structure: dict) -> AdminSalaryStructureResponse:
        earnings = structure.get("earnings", [])
        gross_salary = sum(earning["amount"] for earning in earnings)

        min_salary = structure.get("min_salary")

        if min_salary is None:
            min_salary = parse_salary_floor(structure.get("range"))

        return AdminSalaryStructureResponse(
            id=str(structure["_id"]),
            name=structure.get("name", ""),
            range=structure.get("range", ""),
            min_salary=min_salary,
            max_salary=structure.get("max_salary"),
            earnings=earnings,
            gross_salary=gross_salary,
            deductions=structure.get("deductions", []),
        )

    @staticmethod
    def validate_earnings(earnings: list[dict]):
        names = [earning.get("label", "").strip().casefold() for earning in earnings]
        if len(names) != len(set(names)):
            raise AppException("This earning field already exists in the salary structure", 400)

    async def create_structure(self, data: dict):
        self.validate_earnings(data.get("earnings", []))

        validate_salary_band(
            data.get("min_salary"),
            data.get("max_salary"),
        )

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

        if "earnings" in update_data:
            self.validate_earnings(update_data["earnings"])

        current_min = existing.get("min_salary")
        current_max = existing.get("max_salary")

        if "min_salary" in update_data or "max_salary" in update_data:
            current_min = update_data.get("min_salary", current_min)
            current_max = update_data.get("max_salary", current_max)

        validate_salary_band(current_min, current_max)

        updated = await self.repository.update(structure_id, update_data)

        return self._serialize(updated)

    async def delete_structure(self, structure_id: str):
        deleted = await self.repository.delete(structure_id)

        if not deleted:
            raise AppException("Salary structure not found", 404)

        return True
