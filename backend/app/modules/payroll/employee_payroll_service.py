from datetime import datetime, timezone

from app.core.exceptions import AppException
from app.repositories.employee_payroll_repository import (
    EmployeePayrollRepository,
)


class EmployeePayrollService:
    def __init__(self):
        self.repository = EmployeePayrollRepository()

    async def get_employee_payroll(
        self,
        employee_id: str,
        page: int = 1,
        limit: int = 100,
    ):
        if page < 1:
            raise AppException(
                "Page must be greater than or equal to 1",
                400,
            )

        if limit < 1 or limit > 100:
            raise AppException(
                "Limit must be between 1 and 100",
                400,
            )

        skip = (page - 1) * limit

        records = await self.repository.get_by_employee(
            employee_id=employee_id,
            skip=skip,
            limit=limit,
        )

        total = await self.repository.count_by_employee(
            employee_id=employee_id,
        )

        return {
            "items": [
                self._serialize(record)
                for record in records
            ],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (
                (total + limit - 1) // limit
                if total
                else 1
            ),
        }

    async def get_latest_payroll(
        self,
        employee_id: str,
    ):
        payroll = await self.repository.get_latest_by_employee(
            employee_id=employee_id
        )

        if not payroll:
            raise AppException(
                "Payroll information not found",
                404,
            )

        return self._serialize(payroll)

    async def get_payroll(
        self,
        payroll_id: str,
        employee_id: str,
    ):
        payroll = await self.repository.get_by_id(
            payroll_id
        )

        if not payroll:
            raise AppException(
                "Payroll record not found",
                404,
            )

        if payroll["employee_id"] != employee_id:
            raise AppException(
                "You are not authorized to access this payroll record",
                403,
            )

        return self._serialize(payroll)

    async def get_payroll_by_month(
        self,
        employee_id: str,
        month: str,
    ):
        payroll = await self.repository.get_by_employee_and_month(
            employee_id=employee_id,
            month=month,
        )

        if not payroll:
            raise AppException(
                "Payroll record not found for the requested month",
                404,
            )

        return self._serialize(payroll)

    @staticmethod
    def _serialize(
        document: dict,
    ):
        if not document:
            return None

        pay_period_start = document.get(
            "pay_period_start"
        )

        if isinstance(
            pay_period_start,
            datetime,
        ):
            pay_period_start = pay_period_start.date()

        pay_period_end = document.get(
            "pay_period_end"
        )

        if isinstance(
            pay_period_end,
            datetime,
        ):
            pay_period_end = pay_period_end.date()

        payment = document.get(
            "payment",
            {},
        ).copy()

        paid_on = payment.get(
            "paid_on"
        )

        if isinstance(
            paid_on,
            datetime,
        ):
            payment["paid_on"] = paid_on.date()

        return {
            "id": str(document["_id"]),
            "employee_id": document["employee_id"],
            "month": document["month"],
            "pay_period_start": pay_period_start,
            "pay_period_end": pay_period_end,
            "salary": document.get(
                "salary",
                {},
            ),
            "deductions": document.get(
                "deductions",
                {},
            ),
            "net_salary": document.get(
                "net_salary",
                0,
            ),
            "bank_details": document.get(
                "bank_details",
                {},
            ),
            "payment": payment,
            "tax_details": document.get(
                "tax_details",
                {},
            ),
            "created_at": document.get(
                "created_at"
            ),
            "updated_at": document.get(
                "updated_at"
            ),
        }