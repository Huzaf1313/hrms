from bson import ObjectId

from app.db.database import database


class EmployeeDocumentRepository:
    collection = database["employee_documents"]

    async def create(self, document_data: dict):
        result = await self.collection.insert_one(document_data)

        return await self.collection.find_one(
            {"_id": result.inserted_id}
        )

    async def get_by_id(self, document_id: str):
        if not ObjectId.is_valid(document_id):
            return None

        return await self.collection.find_one(
            {"_id": ObjectId(document_id)}
        )

    async def get_by_employee_id(
        self,
        employee_id: str,
        search: str | None = None,
        document_type: str | None = None,
    ):
        filters = {
            "employee_id": employee_id,
        }

        if search:
            filters["document_name"] = {
                "$regex": search,
                "$options": "i",
            }

        if document_type and document_type.lower() != "all":
            filters["document_type"] = document_type

        cursor = self.collection.find(filters).sort(
            "created_at",
            -1,
        )

        return await cursor.to_list(length=None)

    async def get_summary_by_employee_id(self, employee_id: str):
        documents = await self.collection.find(
            {"employee_id": employee_id}
        ).to_list(length=None)

        categories: dict[str, int] = {}

        for document in documents:
            document_type = document.get("document_type", "Other")

            categories[document_type] = categories.get(
                document_type,
                0,
            ) + 1

        return {
            "total_documents": len(documents),
            "categories": categories,
        }
    async def update(
        self,
        document_id: str,
        update_data: dict,
    ):
        if not ObjectId.is_valid(document_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(document_id)

    async def delete(self, document_id: str):
        if not ObjectId.is_valid(document_id):
            return False

        result = await self.collection.delete_one(
            {"_id": ObjectId(document_id)}
        )

        return result.deleted_count > 0