from bson import ObjectId

from app.db.database import database


class AssetRequestRepository:
    collection = database["asset_requests"]

    async def ensure_indexes(self):
        await self.collection.create_index(
            "request_tag",
            unique=True,
            name="unique_asset_request_tag",
        )
        await self.collection.create_index("status", name="asset_request_status")
        await self.collection.create_index(
            "request_type",
            name="asset_request_type",
        )
        await self.collection.create_index(
            [("requested_at", -1)],
            name="asset_request_requested_at",
        )
        await self.collection.create_index(
            [("status", 1), ("request_type", 1)],
            name="asset_request_status_type",
        )

    async def create(self, request_data: dict):
        result = await self.collection.insert_one(request_data)

        return await self.collection.find_one({"_id": result.inserted_id})

    async def get_by_id(self, request_id: str):
        if not ObjectId.is_valid(request_id):
            return None

        return await self.collection.find_one({"_id": ObjectId(request_id)})

    async def get_all(
        self,
        filters: dict,
        skip: int,
        limit: int,
        sort_field: str = "requested_at",
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

    async def update(self, request_id: str, update_data: dict):
        if not ObjectId.is_valid(request_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(request_id)

    async def count_pending(self, filters: dict | None = None) -> int:
        return await self.collection.count_documents(
            {**(filters or {}), "status": "pending"}
        )