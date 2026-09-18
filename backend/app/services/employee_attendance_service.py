from datetime import datetime

from app.core.exceptions import AppException
from app.repositories.employee_attendance_repository import (
    EmployeeAttendanceRepository,
)
from app.repositories.employee_repository import EmployeeRepository


class EmployeeAttendanceService:
    def __init__(self):
        self.repository = EmployeeAttendanceRepository()
        self.employee_repository = EmployeeRepository()

    async def create_attendance(self, attendance_data: dict):
        employee_id = attendance_data["employee_id"]

        employee = await self.employee_repository.get_by_employee_id(
            employee_id
        )

        if not employee:
            raise AppException(
                "Employee not found",
                404,
            )

        existing_attendance = (
            await self.repository.get_by_employee_and_date(
                employee_id=employee_id,
                attendance_date=attendance_data["date"],
            )
        )

        if existing_attendance:
            raise AppException(
                "Attendance already exists for this employee on this date",
                400,
            )

        attendance_data["created_at"] = datetime.utcnow()
        attendance_data["updated_at"] = datetime.utcnow()

        try:
            return await self.repository.create(attendance_data)

        except Exception:
            existing_attendance = (
                await self.repository.get_by_employee_and_date(
                    employee_id=employee_id,
                    attendance_date=attendance_data["date"],
                )
            )

            if existing_attendance:
                raise AppException(
                    "Attendance already exists for this employee on this date",
                    400,
                )

            raise

    async def get_attendance(self, attendance_id: str):
        attendance = await self.repository.get_by_id(
            attendance_id
        )

        if not attendance:
            raise AppException(
                "Attendance record not found",
                404,
            )

        return attendance

    async def get_employee_attendance(
        self,
        employee_id: str,
        skip: int = 0,
        limit: int = 100,
    ):
        employee = await self.employee_repository.get_by_employee_id(employee_id)
        if not employee:
            employee = await self.employee_repository.get_by_id(employee_id)

        if not employee:
            raise AppException(
                "Employee not found",
                404,
            )

        return await self.repository.get_by_employee(
            employee_id=employee["employee_id"],
            skip=skip,
            limit=limit,
        )

    async def get_attendance_by_date(
        self,
        attendance_date,
        skip: int = 0,
        limit: int = 100,
    ):
        return await self.repository.get_by_date(
            attendance_date=attendance_date,
            skip=skip,
            limit=limit,
        )

    async def get_attendance_by_date_range(
        self,
        start_date,
        end_date,
        skip: int = 0,
        limit: int = 100,
    ):
        if start_date > end_date:
            raise AppException(
                "Start date cannot be after end date",
                400,
            )

        return await self.repository.get_by_date_range(
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit,
        )

    async def update_attendance(
        self,
        attendance_id: str,
        update_data: dict,
    ):
        attendance = await self.repository.get_by_id(
            attendance_id
        )

        if not attendance:
            raise AppException(
                "Attendance record not found",
                404,
            )

        update_data = {
            key: value
            for key, value in update_data.items()
            if value is not None
        }

        employee_id = update_data.get(
            "employee_id",
            attendance["employee_id"],
        )

        attendance_date = update_data.get(
            "date",
            attendance["date"],
        )

        if isinstance(attendance_date, datetime):
            attendance_date = attendance_date.date()

        existing_attendance = (
            await self.repository.get_by_employee_and_date(
                employee_id=employee_id,
                attendance_date=attendance_date,
            )
        )

        if (
            existing_attendance
            and str(existing_attendance["_id"]) != attendance_id
        ):
            raise AppException(
                "Attendance already exists for this employee on this date",
                400,
            )

        if "employee_id" in update_data:
            employee = await self.employee_repository.get_by_id(
                employee_id
            )

            if not employee:
                raise AppException(
                    "Employee not found",
                    404,
                )

        update_data["updated_at"] = datetime.utcnow()

        return await self.repository.update(
            attendance_id,
            update_data,
        )

    async def delete_attendance(
        self,
        attendance_id: str,
    ):
        deleted = await self.repository.delete(
            attendance_id
        )

        if not deleted:
            raise AppException(
                "Attendance record not found",
                404,
            )
        return True
