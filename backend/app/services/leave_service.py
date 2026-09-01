from datetime import date, datetime, time, timedelta, timezone

from bson import ObjectId

from app.core.exceptions import AppException
from app.repositories.department_repository import DepartmentRepository
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.leave_repository import LeaveRepository


class LeaveService:

    def __init__(self):
        self.repository = LeaveRepository()
        self.employee_repository = EmployeeRepository()
        self.department_repository = DepartmentRepository()

    async def create_leave(
        self,
        leave_data: dict,
    ):
        start_date = leave_data["start_date"]
        end_date = leave_data["end_date"]

        if end_date < start_date:
            raise AppException(
                "End date cannot be before start date",
                400,
            )

        start_datetime = datetime.combine(
            start_date,
            time.min,
        )

        end_datetime = datetime.combine(
            end_date,
            time.min,
        )

        existing_leave = await self.repository.find_overlap(
            leave_data["employee_id"],
            start_datetime,
            end_datetime,
        )

        if existing_leave:
            raise AppException(
                "Employee already has an overlapping leave request",
                409,
            )

        now = datetime.now(timezone.utc)

        document = {
            "employee_id": leave_data["employee_id"],
            "leave_type": leave_data["leave_type"],
            "start_date": start_datetime,
            "end_date": end_datetime,
            "reason": leave_data.get("reason"),
            "status": "pending",
            "created_at": now,
            "reviewed_at": None,
            "reviewed_by": None,
            "admin_note": None,
        }

        result = await self.repository.create(document)

        return await self._serialize(result)

    async def get_leave(self, leave_id: str):
        leave = await self.repository.get_by_id(leave_id)

        if not leave:
            raise AppException(
                "Leave request not found",
                404,
            )

        return await self._serialize(leave)

    async def get_leaves(
        self,
        page: int = 1,
        limit: int = 10,
        status: str | None = None,
        employee_id: str | None = None,
        leave_type: str | None = None,
        department_id: str | None = None,
    ):
        filters = {}

        if status:
            filters["status"] = status

        if employee_id:
            filters["employee_id"] = employee_id

        if leave_type:
            filters["leave_type"] = leave_type

        if department_id:
            employees = await self.employee_repository.get_all(
                filters={"department_id": department_id},
                skip=0,
                limit=10000,
            )
            employee_ids = [employee["employee_id"] for employee in employees]
            filters["employee_id"] = {"$in": employee_ids}

        skip = (page - 1) * limit

        records = await self.repository.get_all(
            filters,
            skip,
            limit,
        )

        total = await self.repository.count(filters)

        return {
            "items": [
                await self._serialize(record)
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

    async def update_status(
        self,
        leave_id: str,
        status: str,
        admin_note: str | None,
        admin_user_id: str | None,
    ):
        leave = await self.repository.get_by_id(leave_id)

        if not leave:
            raise AppException(
                "Leave request not found",
                404,
            )

        if leave["status"] in ["approved", "rejected", "cancelled"]:
            raise AppException(
                "This leave request has already been finalized",
                400,
            )

        if status == "pending":
            raise AppException(
                "Admin cannot move a finalized request back to pending",
                400,
            )

        update_data = {
            "status": status,
            "reviewed_at": datetime.now(timezone.utc),
            "reviewed_by": admin_user_id,
            "admin_note": admin_note,
        }

        updated = await self.repository.update(
            leave_id,
            update_data,
        )

        return await self._serialize(updated)

    async def delete_leave(self, leave_id: str):
        leave = await self.repository.get_by_id(leave_id)

        if not leave:
            raise AppException(
                "Leave request not found",
                404,
            )

        deleted = await self.repository.delete(
            leave_id
        )

        if not deleted:
            raise AppException(
                "Unable to delete leave request",
                500,
            )

        return True

    async def get_summary(self):
        today = date.today()

        month_start = datetime.combine(
            today.replace(day=1),
            time.min,
        )

        if today.month == 12:
            next_month = date(
                today.year + 1,
                1,
                1,
            )
        else:
            next_month = date(
                today.year,
                today.month + 1,
                1,
            )

        month_end = datetime.combine(
            next_month,
            time.min,
        )

        today_start = datetime.combine(
            today,
            time.min,
        )

        tomorrow = today + timedelta(days=1)

        tomorrow_start = datetime.combine(
            tomorrow,
            time.min,
        )

        upcoming_end = datetime.combine(
            today + timedelta(days=8),
            time.min,
        )

        return await self.repository.get_summary_counts(
            month_start=month_start,
            month_end=month_end,
            today_start=today_start,
            tomorrow_start=tomorrow_start,
            upcoming_end=upcoming_end,
        )

    async def _serialize(self, document: dict):
        if not document:
            return None

        employee = await self.employee_repository.get_by_employee_id(
            document["employee_id"]
        )
        department_id = employee.get("department_id") if employee else None
        department = (
            await self.department_repository.get_by_id(department_id)
            if department_id
            else None
        )

        return {
            "id": str(document["_id"]),
            "employee_id": document["employee_id"],
            "employee_name": (
                f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()
                if employee
                else None
            ),
            "department_id": department_id,
            "department_name": department.get("name") if department else None,
            "leave_type": document["leave_type"],
            "start_date": document["start_date"].date(),
            "end_date": document["end_date"].date(),
            "reason": document.get("reason"),
            "status": document["status"],
            "created_at": document["created_at"],
            "reviewed_at": document.get("reviewed_at"),
            "reviewed_by": document.get("reviewed_by"),
            "admin_note": document.get("admin_note"),
        }