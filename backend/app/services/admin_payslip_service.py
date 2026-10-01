from datetime import date
from calendar import monthrange

from app.core.exceptions import AppException
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.admin_salary_structure_repository import (
    AdminSalaryStructureRepository,
)
from app.repositories.admin_payslip_repository import (
    AdminPayslipRepository,
)
from app.services.admin_deduction_service import AdminDeductionService


class AdminPayslipService:
    def __init__(self):
        self.payslip_repository = AdminPayslipRepository()
        self.employee_repository = EmployeeRepository()
        self.salary_structure_repository = AdminSalaryStructureRepository()
        self.deduction_service = AdminDeductionService()

    async def create_payslip(
        self,
        employee_id: str,
        month: str,
        year: int,
    ):
        # 1. Find employee
        employee = await self.employee_repository.get_by_employee_id(
            employee_id
        )

        if not employee:
            raise AppException("Employee not found", 404)

        # 2. Check salary structure
        salary_structure_name = employee.get("salary_structure")

        if not salary_structure_name:
            raise AppException(
                "Salary structure is not assigned to this employee",
                400,
            )

        # 3. Find salary structure
        salary_structure = (
            await self.salary_structure_repository.get_by_name(
                salary_structure_name
            )
        )

        if not salary_structure:
            raise AppException(
                f"Salary structure '{salary_structure_name}' not found",
                404,
            )

        # 4. Calculate pay period
        month_number = self._get_month_number(month)

        last_day = monthrange(year, month_number)[1]

        pay_period_start = date(year, month_number, 1)
        pay_period_end = date(year, month_number, last_day)

        # 5. Prevent duplicate payslip
        existing = (
            await self.payslip_repository.get_by_employee_and_month(
                employee_id,
                month,
            )
        )

        if existing:
            raise AppException(
                "Payslip already exists for this employee and month",
                409,
            )

        # 6. Read earnings from salary structure
        earnings = salary_structure.get("earnings", [])

        if not earnings:
            raise AppException(
                "No earnings are configured in the salary structure",
                400,
            )

        gross_salary = round(
            sum(
                float(earning.get("amount", 0))
                for earning in earnings
            ),
            2,
        )

        # 7. Calculate deductions
        deduction_result = (
            await self.deduction_service.calculate_deductions(
                basic_salary=self._get_basic_salary(earnings),
                annual_income=gross_salary * 12,
            )
        )

        total_deductions = deduction_result.total_deductions

        # 8. Calculate net salary
        net_salary = round(
            gross_salary - total_deductions,
            2,
        )

        if net_salary < 0:
            raise AppException(
                "Net salary cannot be negative",
                400,
            )

        # 9. Prepare deduction details
        deduction_items = {}

        for result in deduction_result.results:
            if result.type == "deduction":
                deduction_items[result.code.lower()] = (
                    result.calculated_amount
                )

        deduction_items["total"] = total_deductions

        # 10. Prepare bank details
        bank_information = employee.get("bank_information") or {}

        account_number = bank_information.get("account_number", "")

        bank_details = {
            "bank_name": bank_information.get("bank_name", ""),
            "account_last4": (
                account_number[-4:]
                if account_number
                else "0000"
            ),
        }

        # 11. Prepare payroll document
        payroll_data = {
            "employee_id": employee_id,
            "month": month,
            "pay_period_start": pay_period_start,
            "pay_period_end": pay_period_end,
            "salary": {
                "basic": self._get_basic_salary(earnings),
                "earnings": earnings,
                "gross": gross_salary,
            },
            "deductions": deduction_items,
            "net_salary": net_salary,
            "bank_details": bank_details,
            "payment": {
                "paid_on": None,
                "status": "Processing",
            },
            "tax_details": {
                "taxable_income": gross_salary * 12,
                "tax_deducted": 0,
            },
        }

        # 12. Save payroll
        payroll = await self.payslip_repository.create(
            payroll_data
        )

        return self._serialize(payroll)

    async def get_all_payslips(
        self,
        page: int = 1,
        limit: int = 20,
    ):
        if page < 1:
            raise AppException(
                "Page must be greater than 0",
                400,
            )

        if limit < 1 or limit > 100:
            raise AppException(
                "Limit must be between 1 and 100",
                400,
            )

        skip = (page - 1) * limit

        payslips = await self.payslip_repository.get_all(
            skip=skip,
            limit=limit,
        )

        total = await self.payslip_repository.count()

        return {
            "items": [
                self._serialize(payslip)
                for payslip in payslips
            ],
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit,
        }

    async def get_payslip_by_id(self, payslip_id: str):
        payslip = await self.payslip_repository.get_by_id(
            payslip_id
        )

        if not payslip:
            raise AppException(
                "Payslip not found",
                404,
            )

        return self._serialize(payslip)

    async def download_payslip(self, payslip_id: str):
        payslip = await self.payslip_repository.get_by_id(
            payslip_id
        )

        if not payslip:
            raise AppException(
                "Payslip not found",
                 404,
          )

        return payslip

    @staticmethod
    def _get_basic_salary(earnings: list[dict]) -> float:
        for earning in earnings:
            label = str(
                earning.get("label", "")
            ).strip().lower()

            if label in {
                "basic",
                "basic salary",
                "basic pay",
            }:
                return float(
                    earning.get("amount", 0)
                )

        # If no explicitly named Basic Salary exists,
        # use the first earning as the basic amount.
        return float(
            earnings[0].get("amount", 0)
        )

    @staticmethod
    def _get_month_number(month: str) -> int:
        month_map = {
            "january": 1,
            "february": 2,
            "march": 3,
            "april": 4,
            "may": 5,
            "june": 6,
            "july": 7,
            "august": 8,
            "september": 9,
            "october": 10,
            "november": 11,
            "december": 12,
        }

        month_number = month_map.get(
            month.strip().lower()
        )

        if not month_number:
            raise AppException(
                "Invalid month name",
                400,
            )

        return month_number

    @staticmethod
    def _serialize(document: dict):
        if not document:
            return None

        return {
            "id": str(document["_id"]),
            "employee_id": document["employee_id"],
            "month": document["month"],
            "pay_period_start": document["pay_period_start"],
            "pay_period_end": document["pay_period_end"],
            "salary": document.get("salary", {}),
            "deductions": document.get("deductions", {}),
            "net_salary": document.get("net_salary", 0),
            "bank_details": document.get("bank_details", {}),
            "payment": document.get("payment", {}),
            "tax_details": document.get("tax_details", {}),
            "created_at": document.get("created_at"),
            "updated_at": document.get("updated_at"),
        }
