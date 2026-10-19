from bson import ObjectId

from app.db.database import database


class HolidayRepository:
    collection = database["holidays"]

    async def ensure_indexes(self):
        # One holiday per name per day. Two different holidays may share a date
        # (e.g. a festival that also marks an anniversary), so the name is part
        # of the key rather than the date alone.
        await self.collection.create_index(
            [("date", 1), ("name", 1)],
            unique=True,
            name="unique_holiday_date_name",
        )

        # Calendars always read by date range.
        await self.collection.create_index(
            [("date", 1)],
            name="holiday_date",
        )

    async def create(self, holiday_data: dict):
        result = await self.collection.insert_one(holiday_data)

        return await self.collection.find_one({"_id": result.inserted_id})

    async def get_by_id(self, holiday_id: str):
        if not ObjectId.is_valid(holiday_id):
            return None

        return await self.collection.find_one({"_id": ObjectId(holiday_id)})

    async def get_by_date_and_name(self, date: str, name: str):
        """Used for the duplicate check before creating or renaming a holiday."""
        return await self.collection.find_one({"date": date, "name": name})

    async def get_range(self, start_date: str, end_date: str):
        """Inclusive on both ends. Dates are "YYYY-MM-DD", so a lexicographic
        range comparison is also a chronological one."""
        cursor = self.collection.find(
            {
                "date": {"$gte": start_date, "$lte": end_date},
            }
        ).sort("date", 1)

        return await cursor.to_list(length=500)

    async def get_all(self, limit: int = 500):
        cursor = self.collection.find({}).sort("date", 1).limit(limit)

        return await cursor.to_list(length=limit)

    async def update(self, holiday_id: str, update_data: dict):
        if not ObjectId.is_valid(holiday_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(holiday_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(holiday_id)

    async def delete(self, holiday_id: str):
        if not ObjectId.is_valid(holiday_id):
            return False

        result = await self.collection.delete_one({"_id": ObjectId(holiday_id)})

        return result.deleted_count > 0