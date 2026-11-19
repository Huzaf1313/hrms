import re

from app.core.exceptions import AppException
from app.db.database import database
from app.repositories.admin_salary_structure_repository import (
    AdminSalaryStructureRepository,
)
from app.modules.payroll.salary_structure_schemas import AdminSalaryStructureResponse


def parse_salary_floor(range_text: str | None) -> float | None:
    """Derive a minimum from the free-text range, e.g. '12000' or '12,000 - 20,000'."""
    if not range_text:
        return None

    match = re.search(r"\d[\d,]*", str(range_text))

    if not match:
        return None

    value = float(match.group(0).replace(",", ""))

    return value if value >= 0 else None


def validate_salary_band(
    min_salary: float | None,
    max_salary: float | None,
):
    if min_salary is not None and min_salary < 0:
        raise AppException("Minimum salary cannot be negative", 400)

    if max_salary is not None and max_salary < 0:
        raise AppException("Maximum salary cannot be negative", 400)

    if min_salary is not None and max_salary is not None:
        if max_salary < min_salary:
            raise AppException(
                "Maximum salary cannot be lower than the minimum salary",
                400,
            )


def validate_salary_limit(
    earnings: list[dict],
    max_salary: float | None,
):
    if max_salary is None:
        return

    total_earnings = sum(
        float(earning.get("amount", 0) or 0)
        if isinstance(earning, dict)
        else float(getattr(earning, "amount", 0) or 0)
        for earning in earnings
    )

    if round(total_earnings, 2) > round(max_salary, 2):
        raise AppException(
            "The sum of all earning components cannot exceed the maximum salary limit",
            400,
        )


class AdminSalaryStructureService:
    def __init__(self):
        self.repository = AdminSalaryStructureRepository()
        self.user_collection = database["users"]

    def _serialize(self, structure: dict) -> AdminSalaryStructureResponse:
        earnings = structure.get("earnings", [])
        gross_salary = sum(float(earning.get("amount", 0)) for earning in earnings)

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
            gross_salary=round(gross_salary, 2),
            deductions=structure.get("deductions", []),
        )

    @staticmethod
    def validate_earnings(earnings: list[dict]):
        if not earnings:
            raise AppException("At least one earning component is required", 400)

        names = []
        for earning in earnings:
            label = (earning.get("label") or "").strip()
            if not label:
                raise AppException("Earning component label cannot be empty", 400)

            amount = earning.get("amount", 0)
            try:
                numeric_amount = float(amount)
                if numeric_amount < 0:
                    raise AppException("Earning component amount cannot be negative", 400)
            except (ValueError, TypeError):
                raise AppException("Earning component amount must be a number", 400)

            names.append(label.casefold())

        if len(names) != len(set(names)):
            raise AppException("This earning field already exists in the salary structure", 400)

    async def create_structure(self, data: dict):
        name = (data.get("name") or "").strip()
        if not name:
            raise AppException("Salary structure name cannot be empty", 400)

        # Check for duplicate structure name
        existing = await self.repository.get_by_name(name)
        if existing:
            raise AppException(f"A salary structure named '{name}' already exists", 409)

        data["name"] = name

        earnings = data.get("earnings", [])
        self.validate_earnings(earnings)

        min_sal = data.get("min_salary")
        max_sal = data.get("max_salary")
        validate_salary_band(min_sal, max_sal)
        validate_salary_limit(earnings, max_sal)

        # Auto-format range if empty or blank
        range_str = (data.get("range") or "").strip()
        if not range_str:
            if min_sal is not None and max_sal is not None:
                range_str = f"{int(min_sal):,} - {int(max_sal):,}"
            elif min_sal is not None:
                range_str = f"{int(min_sal):,}+"
            elif max_sal is not None:
                range_str = f"Up to {int(max_sal):,}"
            else:
                range_str = "Flexible"
        data["range"] = range_str


        # Initialize deductions array if not present
        data.setdefault("deductions", [])

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

        old_name = existing.get("name", "")

        # Check name change
        if "name" in update_data:
            new_name = update_data["name"].strip()
            if not new_name:
                raise AppException("Salary structure name cannot be empty", 400)

            if new_name.lower() != old_name.lower():
                duplicate = await self.repository.get_by_name(new_name)
                if duplicate and str(duplicate["_id"]) != structure_id:
                    raise AppException(f"A salary structure named '{new_name}' already exists", 409)

            update_data["name"] = new_name

        if "earnings" in update_data:
            self.validate_earnings(update_data["earnings"])

        current_min = existing.get("min_salary")
        if current_min is None:
            current_min = parse_salary_floor(existing.get("range"))
        current_max = existing.get("max_salary")

        if "min_salary" in update_data:
            current_min = update_data.get("min_salary")
        if "max_salary" in update_data:
            current_max = update_data.get("max_salary")

        validate_salary_band(current_min, current_max)

        final_earnings = update_data.get("earnings", existing.get("earnings", []))
        validate_salary_limit(final_earnings, current_max)

        # Update range if min/max changed and range wasn't explicitly given
        if ("min_salary" in update_data or "max_salary" in update_data) and "range" not in update_data:
            if current_min is not None and current_max is not None:
                update_data["range"] = f"{int(current_min):,} - {int(current_max):,}"
            elif current_min is not None:
                update_data["range"] = f"{int(current_min):,}+"
            elif current_max is not None:
                update_data["range"] = f"Up to {int(current_max):,}"


        updated = await self.repository.update(structure_id, update_data)

        # If structure was renamed, sync assigned employees in users collection
        if "name" in update_data and update_data["name"] != old_name:
            await self.user_collection.update_many(
                {"salary_structure": old_name},
                {"$set": {"salary_structure": update_data["name"]}},
            )

        return self._serialize(updated)

    async def delete_structure(self, structure_id: str):
        existing = await self.repository.get_by_id(structure_id)

        if not existing:
            raise AppException("Salary structure not found", 404)

        structure_name = existing.get("name", "")

        # Safe deletion: verify no employees are assigned to this structure
        assigned_count = await self.user_collection.count_documents(
            {"salary_structure": structure_name}
        )

        if assigned_count > 0:
            raise AppException(
                f"Cannot delete salary structure '{structure_name}' because it is assigned to {assigned_count} employee(s). Please reassign them before deleting.",
                400,
            )

        deleted = await self.repository.delete(structure_id)

        if not deleted:
            raise AppException("Salary structure not found", 404)

        return True

