from datetime import date, datetime

from app.core.exceptions import AppException
from app.repositories.department_repository import DepartmentRepository
from app.repositories.employee_attendance_repository import (
    EmployeeAttendanceRepository,
)
from app.repositories.employee_leave_repository import (
    EmployeeLeaveRepository,
)
from app.repositories.employee_payroll_repository import (
    EmployeePayrollRepository,
)
from app.repositories.employee_repository import EmployeeRepository


class EmployeePayslipService:
    def __init__(self):
        self.payroll_repository = EmployeePayrollRepository()
        self.employee_repository = EmployeeRepository()
        self.department_repository = DepartmentRepository()
        self.attendance_repository = EmployeeAttendanceRepository()
        self.leave_repository = EmployeeLeaveRepository()

    async def get_payslip_data(
        self,
        payroll_id: str,
        employee_id: str,
    ):
        payroll = await self.payroll_repository.get_by_id(payroll_id)

        if not payroll:
            raise AppException(
                "Payroll record not found",
                404,
            )

        # Make sure the logged-in employee owns this payroll record.
        if payroll["employee_id"] != employee_id:
            raise AppException(
                "You are not authorized to access this payslip",
                403,
            )

        employee = await self.employee_repository.get_by_employee_id(
            employee_id
        )

        if not employee:
            raise AppException(
                "Employee not found",
                404,
            )

        department = None

        department_id = employee.get("department_id")

        if department_id:
            department = await self.department_repository.get_by_id(
                department_id
            )

        start_date = self._to_date(
            payroll["pay_period_start"]
        )

        end_date = self._to_date(
            payroll["pay_period_end"]
        )

        attendance_records = (
            await self.attendance_repository.get_by_date_range(
                start_date=start_date,
                end_date=end_date,
            )
        )

        employee_attendance = [
            record
            for record in attendance_records
            if record.get("employee_id") == employee_id
        ]

        approved_leaves = await self.leave_repository.get_balance_records(
            employee_id=employee_id
        )

        period_leaves = [
            leave
            for leave in approved_leaves
            if self._leave_overlaps_period(
                leave,
                start_date,
                end_date,
            )
        ]

        attendance_summary = self._calculate_attendance_summary(
            start_date=start_date,
            end_date=end_date,
            attendance_records=employee_attendance,
            approved_leaves=period_leaves,
        )

        return {
            "payroll": payroll,
            "employee": employee,
            "department": department,
            "attendance_summary": attendance_summary,
        }

    async def generate_payslip_pdf(
        self,
        payroll_id: str,
        employee_id: str,
    ):
        raise AppException(
            "Payslip PDF generation has been disabled",
            410,
        )

    @staticmethod
    def _calculate_attendance_summary(
        start_date: date,
        end_date: date,
        attendance_records: list,
        approved_leaves: list,
    ):
        total_days = (
            end_date - start_date
        ).days + 1

        attendance_by_date = {
            EmployeePayslipService._to_date(
                record.get("date")
            ): record
            for record in attendance_records
        }

        leave_dates = set()

        for leave in approved_leaves:
            leave_start = EmployeePayslipService._to_date(
                leave.get("start_date")
            )

            leave_end = EmployeePayslipService._to_date(
                leave.get("end_date")
            )

            current = max(
                leave_start,
                start_date,
            )

            last = min(
                leave_end,
                end_date,
            )

            while current <= last:
                leave_dates.add(current)

                current = current.fromordinal(
                    current.toordinal() + 1
                )

        present_days = 0

        for attendance_date, record in attendance_by_date.items():
            if not (
                start_date
                <= attendance_date
                <= end_date
            ):
                continue

            status = str(
                record.get("status", "")
            ).strip().lower()

            if status in {
                "present",
                "late",
            }:
                present_days += 1

        paid_leave = len(leave_dates)

        holidays = 0

        working_days = total_days

        return {
            "working_days": working_days,
            "present_days": present_days,
            "paid_leave": paid_leave,
            "unpaid_leave": 0,
            "holidays": holidays,
        }

    @staticmethod
    def _leave_overlaps_period(
        leave: dict,
        start_date: date,
        end_date: date,
    ) -> bool:
        leave_start = EmployeePayslipService._to_date(
            leave.get("start_date")
        )

        leave_end = EmployeePayslipService._to_date(
            leave.get("end_date")
        )

        return (
            leave_start <= end_date
            and leave_end >= start_date
        )

    @staticmethod
    def _to_date(value):
        if isinstance(value, datetime):
            return value.date()

        if isinstance(value, date):
            return value

        if isinstance(value, str):
            return date.fromisoformat(value)

        raise ValueError(
            f"Unable to convert value to date: {value}"
        )

    @staticmethod
    def _format_date(value):
        if not value:
            return "Not available"

        try:
            converted = EmployeePayslipService._to_date(
                value
            )

            return converted.strftime(
                "%d %b %Y"
            )

        except (TypeError, ValueError):
            return "Not available"

    @staticmethod
    def _currency(value):
        try:
            return f"Rs. {float(value):,.2f}"
        except (TypeError, ValueError):
            return "Rs. 0.00"
