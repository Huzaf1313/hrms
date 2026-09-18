from app.core.exceptions import AppException
from app.repositories.admin_deduction_repository import (
    AdminDeductionRepository,
)
from app.repositories.admin_salary_structure_repository import (
    AdminSalaryStructureRepository,
)
from app.schemas.admin_deduction import (
    AdminDeductionResponse,
    DeductionCalculationResult,
    DeductionCalculationResponse,
)


class AdminDeductionService:
    def __init__(self):
        self.repository = AdminDeductionRepository()
        self.salary_structure_repository = AdminSalaryStructureRepository()

    def _serialize(self, deduction: dict) -> AdminDeductionResponse:
        return AdminDeductionResponse(
            id=str(deduction["_id"]),
            name=deduction.get("name", ""),
            code=deduction.get("code", ""),
            type=deduction.get("type", "deduction"),
            calculation_method=deduction.get(
                "calculation_method",
                "percentage_of_basic",
            ),
            percentage=deduction.get("percentage"),
            fixed_amount=deduction.get("fixed_amount"),
            description=deduction.get("description"),
            is_active=deduction.get("is_active", True),
        )

    async def create_deduction(self, data: dict):
        deduction = await self.repository.create(data)

        return self._serialize(deduction)

    async def get_deduction(self, deduction_id: str):
        deduction = await self.repository.get_by_id(deduction_id)

        if not deduction:
            raise AppException("Deduction or contribution not found", 404)

        return self._serialize(deduction)

    async def get_all_deductions(
        self,
        skip: int = 0,
        limit: int = 100,
    ):
        deductions = await self.repository.get_all(
            filters={},
            skip=skip,
            limit=limit,
        )

        return [
            self._serialize(deduction)
            for deduction in deductions
        ]

    async def update_deduction(
        self,
        deduction_id: str,
        update_data: dict,
    ):
        existing = await self.repository.get_by_id(deduction_id)

        if not existing:
            raise AppException(
                "Deduction or contribution not found",
                404,
            )

        update_data = {
            key: value
            for key, value in update_data.items()
            if value is not None
        }

        updated = await self.repository.update(
            deduction_id,
            update_data,
        )

        return self._serialize(updated)

    async def delete_deduction(self, deduction_id: str):
        deleted = await self.repository.delete(deduction_id)

        if not deleted:
            raise AppException(
                "Deduction or contribution not found",
                404,
            )

        return True

    async def apply_to_all_salary_structures(self, deduction_id: str):
        deduction = await self.repository.get_by_id(deduction_id)

        if not deduction:
            raise AppException("Deduction or contribution not found", 404)

        return await self.salary_structure_repository.apply_deduction_to_all(deduction)

    async def calculate_deductions(
        self,
        basic_salary: float,
        annual_income: float,
    ):
        deductions = await self.repository.get_all(
            filters={"is_active": True},
            skip=0,
            limit=100,
        )

        results = []

        total_deductions = 0.0
        total_contributions = 0.0

        for deduction in deductions:
            method = deduction.get("calculation_method")
            percentage = deduction.get("percentage") or 0
            fixed_amount = deduction.get("fixed_amount") or 0

            calculated_amount = 0.0

            if method == "percentage_of_basic":
                calculated_amount = (
                    basic_salary * percentage / 100
                )

            elif method == "fixed_amount":
                calculated_amount = fixed_amount

            elif method == "slab_based":
                # Slab rules can be extended later.
                # For now, use the configured fixed amount.
                calculated_amount = fixed_amount

            elif method == "tax_calculation":
                # Detailed tax slabs can be added later.
                # For now, use the configured percentage.
                calculated_amount = (
                    annual_income * percentage / 100
                )

            calculated_amount = round(calculated_amount, 2)

            result = DeductionCalculationResult(
                id=str(deduction["_id"]),
                name=deduction.get("name", ""),
                code=deduction.get("code", ""),
                type=deduction.get("type", "deduction"),
                calculated_amount=calculated_amount,
            )

            results.append(result)

            if deduction.get("type") == "deduction":
                total_deductions += calculated_amount
            else:
                total_contributions += calculated_amount

        return DeductionCalculationResponse(
            basic_salary=basic_salary,
            annual_income=annual_income,
            results=results,
            total_deductions=round(total_deductions, 2),
            total_contributions=round(total_contributions, 2),
        )
