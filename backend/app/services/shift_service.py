from datetime import datetime

from app.core.exceptions import AppException
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.shift_repository import ShiftRepository
from app.schemas.shift import ShiftResponse
from app.services.attendance_calculation import (
    shift_duration_minutes,
    shift_is_overnight,
)


class ShiftService:
    def __init__(self):
        self.repository = ShiftRepository()
        self.employee_repository = EmployeeRepository()

    def _serialize(
        self,
        shift: dict,
        assigned_employee_count: int = 0,
    ) -> ShiftResponse:
        start_time = shift.get("start_time", "")
        end_time = shift.get("end_time", "")

        duration = shift_duration_minutes(start_time, end_time)

        return ShiftResponse(
            id=str(shift["_id"]),
            name=shift.get("name", ""),
            start_time=start_time,
            end_time=end_time,
            duration_minutes=duration if duration is not None else 0,
            is_overnight=shift_is_overnight(start_time, end_time),
            is_active=shift.get("is_active", True),
            notes=shift.get("notes"),
            assigned_employee_count=assigned_employee_count,
        )

    async def _assigned_counts(self, shift_ids: list[str]) -> dict[str, int]:
        """How many active employees sit on each of the given shifts."""
        if not shift_ids:
            return {}

        cursor = self.employee_repository.collection.aggregate(
            [
                {
                    "$match": {
                        "employee_id": {"$exists": True},
                        "shift_id": {"$in": shift_ids},
                    },
                },
                {"$group": {"_id": "$shift_id", "count": {"$sum": 1}}},
            ]
        )

        results = await cursor.to_list(length=None)

        return {item["_id"]: item["count"] for item in results}

    async def create_shift(self, data: dict):
        name = str(data["name"]).strip()

        if await self.repository.get_by_name(name):
            raise AppException("A shift with this name already exists", 400)

        shift_data = {
            "name": name,
            "start_time": data["start_time"],
            "end_time": data["end_time"],
            "is_active": data.get("is_active", True),
            "notes": data.get("notes"),
            "created_at": datetime.utcnow(),
        }

        shift = await self.repository.create(shift_data)

        return self._serialize(shift)

    async def get_shift(self, shift_id: str):
        shift = await self.repository.get_by_id(shift_id)

        if not shift:
            raise AppException("Shift not found", 404)

        counts = await self._assigned_counts([shift_id])

        return self._serialize(shift, counts.get(shift_id, 0))

    async def get_all_shifts(
        self,
        include_inactive: bool = True,
    ) -> list[ShiftResponse]:
        filters = {} if include_inactive else {"is_active": True}

        shifts = await self.repository.get_all(filters=filters)

        counts = await self._assigned_counts(
            [str(shift["_id"]) for shift in shifts]
        )

        return [
            self._serialize(shift, counts.get(str(shift["_id"]), 0))
            for shift in shifts
        ]

    async def update_shift(self, shift_id: str, update_data: dict):
        existing = await self.repository.get_by_id(shift_id)

        if not existing:
            raise AppException("Shift not found", 404)

        update_data = {
            key: value
            for key, value in update_data.items()
            if value is not None
        }

        if "name" in update_data:
            name = str(update_data["name"]).strip()

            duplicate = await self.repository.get_by_name(name)

            if duplicate and str(duplicate["_id"]) != shift_id:
                raise AppException("A shift with this name already exists", 400)

            update_data["name"] = name

        if "start_time" in update_data and "end_time" not in update_data:
            update_data["end_time"] = existing.get("end_time")

        if "end_time" in update_data and "start_time" not in update_data:
            update_data["start_time"] = existing.get("start_time")

        update_data["updated_at"] = datetime.utcnow()

        updated = await self.repository.update(shift_id, update_data)

        counts = await self._assigned_counts([shift_id])

        return self._serialize(updated, counts.get(shift_id, 0))

    async def delete_shift(self, shift_id: str):
        existing = await self.repository.get_by_id(shift_id)

        if not existing:
            raise AppException("Shift not found", 404)

        assigned = await self.employee_repository.collection.count_documents(
            {
                "employee_id": {"$exists": True},
                "shift_id": shift_id,
            }
        )

        if assigned:
            raise AppException(
                f"This shift is assigned to {assigned} employee(s). "
                "Reassign them to another shift before deleting it.",
                400,
            )

        await self.repository.delete(shift_id)

        return True

    async def assign_to_employee(
        self,
        employee_id: str,
        shift_id: str | None,
    ):
        employee = await self.employee_repository.get_by_id(employee_id)

        if not employee:
            employee = await self.employee_repository.get_by_employee_id(
                employee_id
            )

        if not employee:
            raise AppException("Employee not found", 404)

        if shift_id:
            shift = await self.repository.get_by_id(shift_id)

            if not shift:
                raise AppException("Shift not found", 404)

            if not shift.get("is_active", True):
                raise AppException(
                    "This shift is inactive and cannot be assigned",
                    400,
                )

        await self.employee_repository.update(
            str(employee["_id"]),
            {
                "shift_id": shift_id,
                "updated_at": datetime.utcnow(),
            },
        )

        return True

    async def get_employee_shift(self, employee_id: str) -> ShiftResponse | None:
        employee = await self.employee_repository.get_by_id(employee_id)

        if not employee:
            employee = await self.employee_repository.get_by_employee_id(
                employee_id
            )

        if not employee:
            raise AppException("Employee not found", 404)

        shift_id = employee.get("shift_id")

        if not shift_id:
            return None

        shift = await self.repository.get_by_id(shift_id)

        if not shift:
            return None

        counts = await self._assigned_counts([shift_id])

        return self._serialize(shift, counts.get(shift_id, 0))
