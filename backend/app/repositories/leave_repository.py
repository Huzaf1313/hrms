from datetime import datetime

from bson import ObjectId

from app.db.database import database


class LeaveRepository:
    # Employee leave requests are stored in the shared employee_leave
    # collection. The previous collection name caused admin queries to return
    # an empty list and zero KPI counts.
    collection = database["employee_leave"]

    async def create(self, leave_data: dict):
        result = await self.collection.insert_one(leave_data)

        return await self.collection.find_one(
            {"_id": result.inserted_id}
        )

    async def get_by_id(self, leave_id: str):
        if not ObjectId.is_valid(leave_id):
            return None

        return await self.collection.find_one(
            {"_id": ObjectId(leave_id)}
        )

    async def get_all(
        self,
        filters: dict,
        skip: int,
        limit: int,
    ):
        cursor = (
            self.collection
            .find(filters)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def count(self, filters: dict):
        return await self.collection.count_documents(filters)

    async def update(
        self,
        leave_id: str,
        update_data: dict,
    ):
        if not ObjectId.is_valid(leave_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(leave_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(leave_id)

    async def delete(self, leave_id: str):
        if not ObjectId.is_valid(leave_id):
            return False

        result = await self.collection.delete_one(
            {"_id": ObjectId(leave_id)}
        )

        return result.deleted_count > 0

    async def rename_leave_type(self, old_name: str, new_name: str):
        await self.collection.update_many(
            {"leave_type": old_name},
            {"$set": {"leave_type": new_name}},
        )

    async def find_overlap(
        self,
        employee_id: str,
        start_date: datetime,
        end_date: datetime,
    ):
        return await self.collection.find_one(
            {
                "employee_id": employee_id,
                "status": {
                    "$in": ["pending", "approved"]
                },
                "start_date": {
                    "$lte": end_date
                },
                "end_date": {
                    "$gte": start_date
                },
            }
        )

    
    async def get_summary_counts(
        self,
        month_start: datetime,
        month_end: datetime,
        today_start: datetime,
        tomorrow_start: datetime,
        upcoming_end: datetime,
        employee_ids: list[str] | None = None,
    ):
        employee_scope = (
            {"employee_id": {"$in": employee_ids}}
            if employee_ids is not None
            else {}
        )

        def scoped(query: dict) -> dict:
            return {**query, **employee_scope}

        total = await self.collection.count_documents(
            scoped({
                "created_at": {
                    "$gte": month_start,
                    "$lt": month_end,
                }
            })
        )

        pending = await self.collection.count_documents(
            scoped({
                "created_at": {
                    "$gte": month_start,
                    "$lt": month_end,
                },
                "status": {
                    "$regex": "^pending$",
                    "$options": "i",
                },
            })
        )

        approved = await self.collection.count_documents(
            scoped({
                "created_at": {
                    "$gte": month_start,
                    "$lt": month_end,
                },
                "status": {
                    "$regex": "^approved$",
                    "$options": "i",
                },
            })
        )

        rejected = await self.collection.count_documents(
            scoped({
                "created_at": {
                    "$gte": month_start,
                    "$lt": month_end,
                },
                "status": {
                    "$regex": "^rejected$",
                    "$options": "i",
                },
            })
        )

        on_leave_today = await self.collection.count_documents(
            scoped({
                "status": {
                    "$regex": "^approved$",
                    "$options": "i",
                },
                "start_date": {"$lte": today_start},
                "end_date": {"$gte": today_start},
            })
        )

        upcoming_leaves = await self.collection.count_documents(
            scoped({
                "status": {
                    "$regex": "^approved$",
                    "$options": "i",
                },
                "start_date": {
                    "$gte": tomorrow_start,
                    "$lt": upcoming_end,
                },
            })
        )

        return {
            "total_leave_requests": total,
            "pending_requests": pending,
            "approved_requests": approved,
            "rejected_requests": rejected,
            "on_leave_today": on_leave_today,
            "upcoming_leaves": upcoming_leaves,
        }
