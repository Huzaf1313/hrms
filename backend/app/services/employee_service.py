import logging
from datetime import datetime, timezone

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.roles import UserRole
from app.core.security import hash_password
from app.repositories.admin_salary_structure_repository import (
    AdminSalaryStructureRepository,
)
from app.repositories.department_repository import DepartmentRepository
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.shift_repository import ShiftRepository
from app.repositories.user_repository import UserRepository
from app.services.admin_salary_structure_service import parse_salary_floor
from app.services.email_service import EmailService
from app.services.otp_service import OTPService
from app.utils.filtering import build_filter
from app.utils.pagination import PaginationParams

logger = logging.getLogger(__name__)


class EmployeeService:
    def __init__(self):
        self.repository = EmployeeRepository()
        self.user_repository = UserRepository()
        self.department_repository = DepartmentRepository()
        self.salary_structure_repository = AdminSalaryStructureRepository()
        self.shift_repository = ShiftRepository()
        self.otp_service = OTPService()
        self.email_service = EmailService()

    async def _validate_shift(self, shift_id: str | None):
        if not shift_id:
            return

        shift = await self.shift_repository.get_by_id(shift_id)

        if not shift:
            raise AppException("Shift not found", 400)

        if not shift.get("is_active", True):
            raise AppException(
                "This shift is inactive and cannot be assigned",
                400,
            )

    async def _validate_salary(
        self,
        salary_structure_name: str | None,
        salary,
    ):
        if not salary_structure_name or salary in (None, ""):
            return

        structure = await self.salary_structure_repository.get_by_name(
            salary_structure_name
        )

        if not structure:
            return

        minimum = structure.get("min_salary")

        if minimum is None:
            minimum = parse_salary_floor(structure.get("range"))

        maximum = structure.get("max_salary")

        if minimum is None and maximum is None:
            return

        try:
            amount = float(salary)
        except (TypeError, ValueError):
            raise AppException("Salary must be a number", 400)

        if minimum is not None and amount < minimum:
            raise AppException(
                f"Salary for '{salary_structure_name}' must be at least "
                f"{int(minimum):,}",
                400,
            )

        if maximum is not None and amount > maximum:
            raise AppException(
                f"Salary for '{salary_structure_name}' cannot be more than "
                f"{int(maximum):,}",
                400,
            )

    async def create_employee(
        self,
        employee_data: dict,
        created_by: str | None = None,
    ):
        # 1. Require and extract email verification token
        verification_token = employee_data.pop("email_verification_token", None)
        if not verification_token or not str(verification_token).strip():
            raise AppException(
                "A valid email verification token is required to add an employee.",
                400,
            )

        # 2. Check Employee ID uniqueness
        existing_employee = await self.repository.get_by_employee_id(
            employee_data["employee_id"]
        )

        if existing_employee:
            raise AppException(
                "Employee ID already exists",
                400,
            )

        # 3. Check Email uniqueness across all accounts
        existing_user = await self.user_repository.get_by_email(
            employee_data["email"]
        )

        if existing_user:
            raise AppException(
                "An account with this email address already exists",
                400,
            )

        # 4. Atomically validate and consume verification token
        await self.otp_service.consume_employee_email_verification(
            token=str(verification_token),
            submitted_email=employee_data["email"],
            admin_id=created_by or "",
        )

        department = await self.department_repository.get_by_id(
            employee_data["department_id"]
        )

        if not department:
            raise AppException(
                "Department not found",
                400,
            )

        await self._validate_salary(
            employee_data.get("salary_structure"),
            employee_data.get("salary"),
        )

        await self._validate_shift(employee_data.get("shift_id"))

        employee_data["status"] = "active"
        employee_data["full_name"] = (
            f'{employee_data["first_name"]} {employee_data["last_name"]}'
        ).strip()
        employee_data["phone_number"] = employee_data["phone"]
        temporary_password = employee_data["password"]
        employee_data["password_hash"] = hash_password(
            employee_data.pop("password")
        )
        employee_data["role"] = UserRole.EMPLOYEE.value
        employee_data["is_active"] = True
        employee_data["is_locked"] = False
        employee_data["failed_login_attempts"] = 0
        employee_data["created_at"] = datetime.now(timezone.utc)
        employee_data["updated_at"] = datetime.now(timezone.utc)

        # The admin who added this person is who their requests route back to.
        # Same convention as assets and job openings.
        employee_data["created_by"] = created_by

        employee = await self.repository.create(employee_data)

        # Dispatch welcome email (do not fail employee creation if SMTP encounters issues)
        welcome_email_sent = False
        try:
            company_name = "HRMS"
            if created_by:
                creator = await self.user_repository.get_by_id(created_by)
                if creator and creator.get("company_name"):
                    company_name = creator["company_name"]

            await self.email_service.send_html_email_async(
                to_email=employee["email"],
                subject=f"Welcome to {company_name}!",
                template_name="emails/welcome_email.html",
                template_data={
                    "company_name": company_name,
                    "employee_name": employee.get("full_name", "Employee"),
                    "hr_team": "HR Team",
                    "login_url": settings.login_url,
                },
            )
            welcome_email_sent = True
        except Exception as exc:
            logger.warning(
                "Welcome email could not be delivered to %s: %s",
                employee.get("email"),
                type(exc).__name__,
            )
            welcome_email_sent = False

        return employee, temporary_password, welcome_email_sent

    async def get_employee(self, employee_id: str):
        employee = await self.repository.get_by_id(employee_id)

        if not employee:
            raise AppException(
                "Employee not found",
                404,
            )

        return employee

    async def get_employees(
        self,
        search: str | None,
        department_id: str | None,
        status: str | None,
        pagination: PaginationParams,
    ):
        filters = build_filter(
            {
                "department_id": department_id,
                "status": status,
            }
        )

        if search:
            filters["$or"] = [
                {
                    "first_name": {
                        "$regex": search,
                        "$options": "i",
                    }
                },
                {
                    "last_name": {
                        "$regex": search,
                        "$options": "i",
                    }
                },
                {
                    "employee_id": {
                        "$regex": search,
                        "$options": "i",
                    }
                },
                {
                    "email": {
                        "$regex": search,
                        "$options": "i",
                    }
                },
            ]

        return await self.repository.get_all(
            filters=filters,
            skip=pagination.skip,
            limit=pagination.limit,
        )

    async def update_employee(
        self,
        employee_id: str,
        update_data: dict,
    ):
        employee = await self.repository.get_by_id(employee_id)

        if not employee:
            raise AppException(
                "Employee not found",
                404,
            )

        update_data = {
            key: value
            for key, value in update_data.items()
            if value is not None
        }

        if "password" in update_data:
            update_data["password_hash"] = hash_password(
                update_data.pop("password")
            )
            update_data["full_name"] = (
                f'{employee["first_name"]} {employee["last_name"]}'
            ).strip()
            update_data["phone_number"] = employee.get("phone")
            update_data["role"] = UserRole.EMPLOYEE.value
            update_data["is_active"] = True
            update_data["is_locked"] = False
            update_data["failed_login_attempts"] = 0

        if "first_name" in update_data or "last_name" in update_data:
            first_name = update_data.get("first_name", employee["first_name"])
            last_name = update_data.get("last_name", employee["last_name"])
            update_data["full_name"] = f"{first_name} {last_name}".strip()

        if "email" in update_data and update_data["email"] != employee.get("email"):
            existing_email = await self.repository.get_by_email(
                update_data["email"]
            )

            if existing_email:
                raise AppException(
                    "Employee email already exists",
                    400,
                )

        if "department_id" in update_data:
            department = await self.department_repository.get_by_id(
                update_data["department_id"]
            )

            if not department:
                raise AppException(
                    "Department not found",
                    400,
                )

        if "salary_structure" in update_data or "salary" in update_data:
            await self._validate_salary(
                update_data.get(
                    "salary_structure",
                    employee.get("salary_structure"),
                ),
                update_data.get("salary", employee.get("salary")),
            )

        if "shift_id" in update_data:
            await self._validate_shift(update_data["shift_id"])

        update_data["updated_at"] = datetime.utcnow()

        return await self.repository.update(
            employee_id,
            update_data,
        )

    async def deactivate_employee(
        self,
        employee_id: str,
    ):
        employee = await self.repository.get_by_id(employee_id)

        if not employee:
            raise AppException(
                "Employee not found",
                404,
            )

        return await self.repository.update_status(
            employee_id=employee_id,
            status="inactive",
            update_data={
                "deactivated_at": datetime.utcnow(),
            },
        )

    async def delete_employee(
        self,
        employee_id: str,
    ):
        deleted = await self.repository.delete(employee_id)

        if not deleted:
            raise AppException(
                "Employee not found",
                404,
            )

        return True