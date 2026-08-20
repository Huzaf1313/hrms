from datetime import datetime

from app.core.exceptions import AppException
from app.repositories.department_repository import DepartmentRepository
from app.repositories.employee_repository import EmployeeRepository
from app.utils.filtering import build_filter
from app.utils.pagination import PaginationParams


class EmployeeService:
    def __init__(self):
        self.repository = EmployeeRepository()
        self.department_repository = DepartmentRepository()

    async def create_employee(self, employee_data: dict):
        existing_employee = await self.repository.get_by_employee_id(
            employee_data["employee_id"]
        )

        if existing_employee:
            raise AppException(
                "Employee ID already exists",
                400,
            )

        existing_email = await self.repository.get_by_email(
            employee_data["email"]
        )

        if existing_email:
            raise AppException(
                "Employee email already exists",
                400,
            )

        department = await self.department_repository.get_by_id(
            employee_data["department_id"]
        )

        if not department:
            raise AppException(
                "Department not found",
                400,
            )

        employee_data["status"] = "active"
        employee_data["created_at"] = datetime.utcnow()
        employee_data["updated_at"] = datetime.utcnow()

        employee = await self.repository.create(employee_data)

        return employee

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