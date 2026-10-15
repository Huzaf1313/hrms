from datetime import datetime

from pymongo.errors import DuplicateKeyError

from app.core.exceptions import AppException
from app.models.holiday import HolidayType
from app.repositories.holiday_repository import HolidayRepository
from app.schemas.holiday import HolidayResponse


class HolidayService:
    def __init__(self):
        self.repository = HolidayRepository()

    def _serialize(self, holiday: dict) -> HolidayResponse:
        return HolidayResponse(
            id=str(holiday["_id"]),
            name=holiday.get("name", ""),
            date=holiday.get("date", ""),
            type=holiday.get("type", HolidayType.PUBLIC.value),
            description=holiday.get("description"),
            is_active=holiday.get("is_active", True),
        )

    async def _reject_duplicate(
        self,
        date: str,
        name: str,
        exclude_id: str | None = None,
    ):
        existing = await self.repository.get_by_date_and_name(date, name)

        if existing and str(existing["_id"]) != exclude_id:
            raise AppException(
                f'"{name}" is already marked as a holiday on {date}',
                400,
            )

    async def create_holiday(self, data: dict) -> HolidayResponse:
        name = data["name"]
        date = data["date"]

        # Checked up front for a clear error message. The unique index below is
        # still the real guard, since two admins can submit at the same moment.
        await self._reject_duplicate(date, name)

        holiday_data = {
            "name": name,
            "date": date,
            "type": data.get("type", HolidayType.PUBLIC.value),
            "description": data.get("description"),
            "is_active": data.get("is_active", True),
            "created_at": datetime.utcnow(),
        }

        try:
            holiday = await self.repository.create(holiday_data)
        except DuplicateKeyError:
            raise AppException(
                f'"{name}" is already marked as a holiday on {date}',
                400,
            )

        return self._serialize(holiday)

    async def get_holidays(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[HolidayResponse]:
        """Holidays for a date range, or every holiday when no range is given.

        Only active holidays are returned, so an admin can retire a past
        holiday by deactivating it instead of deleting the record.
        """
        if start_date and end_date:
            holidays = await self.repository.get_range(start_date, end_date)
        else:
            holidays = await self.repository.get_all()

        active = [item for item in holidays if item.get("is_active", True)]

        return [self._serialize(holiday) for holiday in active]

    async def update_holiday(
        self,
        holiday_id: str,
        update_data: dict,
    ) -> HolidayResponse:
        existing = await self.repository.get_by_id(holiday_id)

        if not existing:
            raise AppException("Holiday not found", 404)

        # Only fields the caller actually sent are applied. A null description
        # is therefore a real "clear it", not "leave it alone" - which a
        # blanket None-strip would have swallowed.
        if not update_data:
            return self._serialize(existing)

        # The duplicate check needs the post-edit name and date, falling back to
        # whatever is already stored when only one of them is changing.
        next_date = update_data.get("date", existing.get("date"))
        next_name = update_data.get("name", existing.get("name"))

        await self._reject_duplicate(next_date, next_name, exclude_id=holiday_id)

        update_data["updated_at"] = datetime.utcnow()

        try:
            updated = await self.repository.update(holiday_id, update_data)
        except DuplicateKeyError:
            raise AppException(
                f'"{next_name}" is already marked as a holiday on {next_date}',
                400,
            )

        return self._serialize(updated)

    async def delete_holiday(self, holiday_id: str):
        existing = await self.repository.get_by_id(holiday_id)

        if not existing:
            raise AppException("Holiday not found", 404)

        await self.repository.delete(holiday_id)

        return True