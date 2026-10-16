from bson import ObjectId
from pymongo import ReturnDocument

from app.db.database import database


class AssetRepository:
    collection = database["assets"]
    # Shared monotonic counters used to mint human-readable ids (AST-001,
    # REQ-001). Counters rather than count()+1 so two concurrent creates can
    # never be handed the same tag.
    counters = database["counters"]

    async def ensure_indexes(self):
        await self.collection.create_index(
            "asset_tag",
            unique=True,
            name="unique_asset_tag",
        )
        await self.collection.create_index("status", name="asset_status")
        await self.collection.create_index("category", name="asset_category")
        await self.collection.create_index(
            "assigned_to_employee_id",
            name="asset_employee",
        )
        await self.collection.create_index(
            [("assigned_to_employee_id", 1), ("status", 1)],
            name="asset_employee_status",
        )
        await self.collection.create_index(
            [("issue_date", -1)],
            name="asset_issue_date",
        )

    async def next_sequence(self, key: str) -> int:
        document = await self.counters.find_one_and_update(
            {"_id": key},
            {"$inc": {"value": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

        return document["value"]

    async def create(self, asset_data: dict):
        result = await self.collection.insert_one(asset_data)

        return await self.collection.find_one({"_id": result.inserted_id})

    async def get_by_id(self, asset_id: str):
        if not ObjectId.is_valid(asset_id):
            return None

        return await self.collection.find_one({"_id": ObjectId(asset_id)})

    async def get_by_tag(self, asset_tag: str):
        return await self.collection.find_one({"asset_tag": asset_tag})

    async def get_all(
        self,
        filters: dict,
        skip: int,
        limit: int,
        sort_field: str = "created_at",
        sort_order: int = -1,
    ):
        cursor = self.collection.find(filters)

        if sort_field:
            cursor = cursor.sort(sort_field, sort_order)

        if skip:
            cursor = cursor.skip(skip)

        if limit:
            cursor = cursor.limit(limit)

        # `to_list(length=0)` returns nothing at all, so an unlimited read has
        # to pass None rather than the falsy limit it skipped applying.
        return await cursor.to_list(length=limit or None)

    async def count(self, filters: dict) -> int:
        return await self.collection.count_documents(filters)

    async def update(self, asset_id: str, update_data: dict):
        if not ObjectId.is_valid(asset_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(asset_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(asset_id)

    async def delete(self, asset_id: str) -> bool:
        if not ObjectId.is_valid(asset_id):
            return False

        result = await self.collection.delete_one({"_id": ObjectId(asset_id)})

        return result.deleted_count > 0

    async def category_counts(self, filters: dict | None = None) -> list[dict]:
        pipeline = [
            {"$match": filters or {}},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        ]

        return await self.collection.aggregate(pipeline).to_list(length=None)

    async def status_counts(self, filters: dict | None = None) -> list[dict]:
        pipeline = [
            {"$match": filters or {}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        ]

        return await self.collection.aggregate(pipeline).to_list(length=None)

    async def total_purchase_value(self, filters: dict | None = None) -> float:
        """Sum of every recorded purchase cost.

        Assets with no cost recorded yet contribute 0 rather than dropping out
        of the sum entirely.
        """

        pipeline = [
            {"$match": filters or {}},
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": {"$ifNull": ["$purchase_cost", 0]}},
                }
            }
        ]

        rows = await self.collection.aggregate(pipeline).to_list(length=None)

        return float(rows[0]["total"]) if rows else 0.0

    async def allocated_this_month(
        self,
        month_start,
        month_end,
        filters: dict | None = None,
    ) -> int:
        return await self.collection.count_documents(
            {
                "issue_date": {"$gte": month_start, "$lt": month_end},
                "assigned_to_employee_id": {"$ne": None},
                **(filters or {}),
            }
        )

    async def get_by_ids(self, asset_ids: list[str]) -> dict[str, dict]:
        """Fetch many assets by id in one query, keyed by id.

        Listing requests needs the live status of every asset they reference;
        resolving them one at a time would make the request list N+1.
        """

        if not asset_ids:
            return {}

        object_ids = [ObjectId(asset_id) for asset_id in asset_ids if ObjectId.is_valid(asset_id)]

        if not object_ids:
            return {}

        cursor = self.collection.find(
            {"_id": {"$in": object_ids}},
            {"status": 1},
        )

        return {
            str(asset["_id"]): asset
            async for asset in cursor
        }

    async def employee_allocation_counts(self, filters: dict | None = None) -> list[dict]:
        """Group assigned assets by employee code.

        Only assets that currently have a holder are grouped; `$ne: None`
        excludes the "unassigned" bucket so the allocation table never grows a
        phantom row for it.
        """

        pipeline = [
            {"$match": {**(filters or {}), "assigned_to_employee_id": {"$ne": None}}},
            {
                "$group": {
                    "_id": "$assigned_to_employee_id",
                    "count": {"$sum": 1},
                }
            },
        ]

        return await self.collection.aggregate(pipeline).to_list(length=None)

    async def department_allocation_counts(self, filters: dict | None = None) -> list[dict]:
        """Group assigned assets by denormalised department."""

        pipeline = [
            {
                "$match": {
                    **(filters or {}),
                    "assigned_to_employee_id": {"$ne": None},
                    "department_id": {"$ne": None},
                }
            },
            {"$group": {"_id": "$department_id", "count": {"$sum": 1}}},
        ]

        return await self.collection.aggregate(pipeline).to_list(length=None)