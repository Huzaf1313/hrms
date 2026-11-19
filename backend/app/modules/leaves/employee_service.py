from datetime import date, datetime, time, timedelta, timezone

from app.core.exceptions import AppException
from app.core.working_days import count_working_days
from app.repositories.employee_leave_repository import (
    EmployeeLeaveRepository,
)
from app.repositories.leave_balance_repository import LeaveBalanceRepository
from app.modules.dashboard.admin_notification_service import AdminNotificationService
from app.modules.dashboard.activity_service import ActivityService

class EmployeeLeaveService:

    LEAVE_ALLOCATIONS = {
        "Casual Leave": 12,
        "Sick Leave": 10,
        "Earned Leave": 18,
        "Comp Off": 5,
    }

    def __init__(self):
        self.repository = EmployeeLeaveRepository()
        self.balance_repository = LeaveBalanceRepository()
        self.admin_notification_service = AdminNotificationService()
        self.activity_service = ActivityService()

    async def create_request(
        self,
        employee_id: str,
        leave_type: str,
        start_date: date,
        end_date: date,
        reason: str,
        attachment_url: str | None = None,
    ):
        # 1. Validate date range
        if end_date < start_date:
            raise AppException(
                "To date cannot be before from date",
                400,
            )

        # 2. Calculate total leave days
        total_days = 0
        current_date = start_date

        while current_date <= end_date:
            # Monday = 0, Sunday = 6
            if current_date.weekday() < 5:
                total_days += 1

            current_date += timedelta(days=1)

        # 3. Validate leave type
        allocations = await self.get_allocations()
        allowed_leave_types = set(allocations)

        if leave_type not in allowed_leave_types:
            raise AppException(
                "Invalid leave type",
                400,
            )

        # 4. Check for overlapping pending/approved leave
        start_datetime = datetime.combine(
            start_date,
            time.min,
        )

        end_datetime = datetime.combine(
            end_date,
            time.min,
        )

        existing_leave = (
            await self.repository.find_overlap(
                employee_id=employee_id,
                start_date=start_datetime,
                end_date=end_datetime,
            )
        )

        if existing_leave:
            raise AppException(
                "You already have an overlapping "
                "pending or approved leave request",
                409,
            )

        # 4b. Enforce consecutive leave rules
        policy_doc = await self.balance_repository.find_by_type(leave_type)
        default_consecutive = 10 if leave_type == "Earned Leave" else 3
        max_consecutive = (
            int(policy_doc.get("max_consecutive_days", default_consecutive))
            if policy_doc
            else default_consecutive
        )
        if max_consecutive and total_days > max_consecutive:
            raise AppException(
                f"{leave_type} cannot exceed {max_consecutive} consecutive working day(s) "
                f"as per leave policy. You requested {total_days} days. "
                f"Please split your request or apply under another leave category.",
                400,
            )

        # 5. Validate leave balance
        balance_records = await self.repository.get_balance_records(
            employee_id=employee_id,
        )
        used_days = sum(
            record.get("total_days", 0)
            for record in balance_records
            if record.get("leave_type") == leave_type
        )

        pending_records = await self.repository.get_pending_by_employee(
            employee_id=employee_id,
        )
        pending_days = sum(
            record.get("total_days", 0)
            for record in pending_records
            if record.get("leave_type") == leave_type
        )

        available_days = max(
            allocations[leave_type] - used_days - pending_days,
            0,
        )

        if total_days > available_days:
            raise AppException(
                f"Insufficient leave balance. You have "
                f"{available_days} day(s) available ({pending_days} day(s) currently pending approval), "
                f"but {total_days} day(s) are requested.",
                400,
            )

        # 6. Create leave request
        now = datetime.now(timezone.utc)

        leave_data = {
            "employee_id": employee_id,
            "leave_type": leave_type,
            "start_date": start_date,
            "end_date": end_date,
            "total_days": total_days,
            "reason": reason,
            "attachment_url": attachment_url,
            "status": "Pending",
            "requested_at": now,
            "reviewed_at": None,
            "reviewed_by": None,
            "admin_note": None,
            "created_at": now,
            "updated_at": now,
        }

        created = await self.repository.create(
            leave_data
        )

        await self.activity_service.record(
            text=f"{employee_id} submitted a {leave_type} request",
            employee_id=employee_id,
            target="/dashboard/leave",
        )

        # The admin who owns this employee needs to see it pending. Wrapped so a
        # notification failure can never lose the leave request itself.
        try:
            await self.admin_notification_service.create_for_employee(
                employee_id=employee_id,
                notification_type="leave_requested",
                title="New leave request",
                message=(
                    f'{leave_type} for {total_days} day(s), '
                    f"{start_date.isoformat()} to {end_date.isoformat()}."
                ),
                target="/dashboard/leave",
                target_id=str(created.get("_id")),
            )
        except Exception:
            pass

        return created

    async def get_employee_requests(
        self,
        employee_id: str,
        page: int = 1,
        limit: int = 100,
        status: str | None = None,
        leave_date: date | None = None,
    ):
        skip = (page - 1) * limit

        records = await self.repository.get_by_employee(
            employee_id=employee_id,
            skip=skip,
            limit=limit,
            status=status,
            leave_date=leave_date,
        )

        total = await self.repository.count_by_employee(
            employee_id=employee_id,
            status=status,
            leave_date=leave_date,
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

    async def get_request(
        self,
        leave_id: str,
        employee_id: str,
    ):
        leave = await self.repository.get_by_id(
            leave_id
        )

        if not leave:
            raise AppException(
                "Leave request not found",
                404,
            )

        # Make sure employee can only access
        # their own leave request.
        if leave["employee_id"] != employee_id:
            raise AppException(
                "You are not authorized to access this leave request",
                403,
            )

        return self._serialize(leave)

    async def get_upcoming_leaves(
        self,
        employee_id: str,
    ):
        today = date.today()

        today_datetime = datetime.combine(
            today,
            time.min,
        )

        records = await self.repository.get_upcoming_by_employee(
            employee_id=employee_id,
            from_date=today_datetime,
        )

        return [
            self._serialize(record)
            for record in records
        ]

    async def get_pending_count(
        self,
        employee_id: str,
    ):
        return await self.repository.count_by_employee(
            employee_id=employee_id,
            status="Pending",
        )
   
    async def get_leave_balance(
        self,
        employee_id: str,
    ):
        # Fetch this employee's leave records.
        records = await self.repository.get_balance_records(
            employee_id=employee_id,
        )

        allocations = await self.get_allocations()

        used: dict[str, int] = {}

        for record in records:
            if str(record.get("status", "")).lower() != "approved":
                continue

            leave_type = record.get("leave_type")
            total_days = record.get("total_days") or 0

            if leave_type:
                used[leave_type] = used.get(leave_type, 0) + total_days

        balances = []

        for leave_type, allocated in allocations.items():
            leave_used = used.get(leave_type, 0)

            balances.append(
                {
                    "leave_type": leave_type,
                    "allocated": allocated,
                    "used": leave_used,
                    "available": max(
                        allocated - leave_used,
                        0,
                    ),
                }
            )

        return balances

    async def get_allocations(self) -> dict[str, int]:
        """Return admin-configured totals, with legacy defaults on first use."""
        all_records = await self.balance_repository.get_all()
        records = [record for record in all_records if record.get("active") is not False]
        known_types = {
            record.get("leave_type") for record in all_records if record.get("leave_type")
        }
        configured = {
            record.get("leave_type"): int(record.get("total", 0))
            for record in records
            if record.get("leave_type")
        }

        allocations = {
            leave_type: configured.get(leave_type, allocation)
            for leave_type, allocation in self.LEAVE_ALLOCATIONS.items()
            if leave_type not in known_types
        }

        allocations.update(configured)

        return allocations

    async def get_leave_types(self) -> list[str]:
        return list((await self.get_allocations()).keys())

    async def cancel_request(
        self,
        leave_id: str,
        employee_id: str,
    ):
        leave = await self.repository.get_by_id(
            leave_id
        )

        if not leave:
            raise AppException(
                "Leave request not found",
                404,
            )

        if leave["employee_id"] != employee_id:
            raise AppException(
                "You are not authorized to cancel this leave request",
                403,
            )

        if str(leave.get("status", "")).strip().lower() != "pending":
            raise AppException(
                "Only pending leave requests can be cancelled",
                400,
            )

        now = datetime.now(timezone.utc)

        updated = await self.repository.update(
            leave_id,
            {
                "status": "Cancelled",
                "updated_at": now,
            },
        )

        return self._serialize(updated)

    @staticmethod
    def _serialize(
        document: dict,
    ):
        if not document:
            return None

        start_date = document["start_date"]

        if isinstance(start_date, datetime):
            start_date = start_date.date()

        end_date = document["end_date"]

        if isinstance(end_date, datetime):
            end_date = end_date.date()

        return {
            "id": str(document["_id"]),
            "employee_id": document["employee_id"],
            "leave_type": document["leave_type"],
            "start_date": start_date,
            "end_date": end_date,
            "total_days": document["total_days"],
            "reason": document.get("reason"),
            "attachment_url": document.get(
                "attachment_url"
            ),
            "status": document["status"],
            "requested_at": document["requested_at"],
            "reviewed_at": document.get(
                "reviewed_at"
            ),
            "reviewed_by": document.get(
                "reviewed_by"
            ),
            "admin_note": document.get(
                "admin_note"
            ),
            "created_at": document["created_at"],
            "updated_at": document["updated_at"],
        }
