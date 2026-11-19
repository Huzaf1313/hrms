from datetime import datetime

from app.core.exceptions import AppException
from app.repositories.employee_attendance_repository import (
    EmployeeAttendanceRepository,
)
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.shift_repository import ShiftRepository
from app.modules.attendance.calculation import (
    compute_work_metrics,
    shift_duration_minutes,
)


class EmployeeAttendanceService:
    def __init__(self):
        self.repository = EmployeeAttendanceRepository()
        self.employee_repository = EmployeeRepository()
        self.shift_repository = ShiftRepository()

    async def _apply_shift_and_metrics(
        self,
        employee: dict,
        record: dict,
    ) -> dict:
        """Snapshot the employee's shift onto the record and measure the day.

        Kept in one place so punch-in and punch-out produce identical shift
        and overtime fields. The snapshot means editing a shift later does not
        rewrite historical attendance.
        """
        shift = None
        shift_id = employee.get("shift_id")

        if shift_id:
            shift = await self.shift_repository.get_by_id(shift_id)

        if shift:
            start_time = shift.get("start_time")
            end_time = shift.get("end_time")
        else:
            start_time = record.get("shift_start")
            end_time = record.get("shift_end")

        duration = shift_duration_minutes(start_time, end_time)

        metrics = compute_work_metrics(
            record.get("check_in"),
            record.get("check_out"),
            shift_duration=duration,
            shift_start=start_time,
        )

        record["shift_id"] = str(shift["_id"]) if shift else record.get("shift_id")
        record["shift"] = (
            shift.get("name") if shift else record.get("shift")
        ) or "General"
        record["shift_start"] = start_time
        record["shift_end"] = end_time
        record["shift_duration_minutes"] = duration
        record["worked_minutes"] = metrics.worked_minutes
        record["overtime_minutes"] = metrics.overtime_minutes
        record["late_minutes"] = metrics.late_minutes
        record["is_overnight"] = metrics.is_overnight

        # Overtime is hours only in this phase. total_hours stays a plain
        # duration of hours so existing payroll reads are unaffected.
        if metrics.worked_minutes is not None:
            record["total_hours"] = round(metrics.worked_minutes / 60, 2)

        return record

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

        attendance_data = await self._apply_shift_and_metrics(
            employee,
            attendance_data,
        )

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
        start_date=None,
        end_date=None,
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
            start_date=start_date,
            end_date=end_date,
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

        employee = await self.employee_repository.get_by_employee_id(
            attendance["employee_id"]
        )

        if not employee:
            employee = await self.employee_repository.get_by_id(
                attendance["employee_id"]
            )

        # Punch-out is where worked time and overtime become known.
        merged = {**attendance, **update_data}
        update_data = await self._apply_shift_and_metrics(employee, merged)

        # Only the fields this helper is responsible for, not the whole
        # existing document.
        for key in (
            "shift_id",
            "shift",
            "shift_start",
            "shift_end",
            "shift_duration_minutes",
            "worked_minutes",
            "overtime_minutes",
            "late_minutes",
            "is_overnight",
        ):
            update_data[key] = merged[key]

        if merged.get("worked_minutes") is not None:
            update_data["total_hours"] = merged["total_hours"]

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
