from bson import ObjectId

from app.db.database import database


class EmployeeRepository:
    collection = database["users"]

    async def create(self, employee_data: dict):
        result = await self.collection.insert_one(employee_data)

        return await self.collection.find_one(
            {"_id": result.inserted_id}
        )

    async def get_by_id(
        self,
        employee_id: str,
        created_by: str | None = None,
    ):
        if not ObjectId.is_valid(employee_id):
            return None

        query = {
            "_id": ObjectId(employee_id),
            "employee_id": {"$exists": True},
        }

        if created_by is not None:
            query["created_by"] = created_by

        return await self.collection.find_one(query)

    async def get_by_employee_id(self, employee_id: str):
        return await self.collection.find_one(
            {
                "employee_id": employee_id,
            }
        )

    async def get_by_email(self, email: str):
        return await self.collection.find_one(
            {
                "email": email,
                "employee_id": {"$exists": True},
            }
        )

    
    async def get_all(
        self,
        filters: dict | None = None,
        skip: int = 0,
        limit: int = 10,
        created_by: str | None = None,
    ):
        query = {
            "employee_id": {"$exists": True},
        }

        if filters:
            query.update(filters)

        # Apply ownership last so regular filters cannot override it.
        if created_by is not None:
            query["created_by"] = created_by

        cursor = (
            self.collection.find(query)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)


    async def count_employees(self):
        return await self.collection.count_documents(
            {"employee_id": {"$exists": True}}
        )

    async def get_celebration_candidates(
        self,
        month_day_values: list[str],
    ):
        """Employees whose date_of_birth or joining_date falls on any of the
        given "MM-DD" strings.

        Both dates are stored as BSON datetimes at midnight (see
        `api/v1/employees.to_datetime`), so reducing them to a month-day string
        sidesteps the year and keeps the query index-friendly on the projection.

        Null or missing dates produce a null month-day string, which fails the
        $in match below - that is how employees without a date_of_birth are
        excluded without a separate filter.
        """
        pipeline = [
            {
                "$match": {
                    "employee_id": {"$exists": True},
                    # Not "== active": records predating the status field have
                    # no value at all, and those must still be celebrated.
                    "status": {"$ne": "inactive"},
                }
            },
            {
                "$addFields": {
                    "dob_month_day": {
                        "$dateToString": {
                            "format": "%m-%d",
                            "date": "$date_of_birth",
                            "onNull": None,
                        }
                    },
                    "joining_month_day": {
                        "$dateToString": {
                            "format": "%m-%d",
                            "date": "$joining_date",
                            "onNull": None,
                        }
                    },
                }
            },
            {
                "$match": {
                    "$or": [
                        {"dob_month_day": {"$in": month_day_values}},
                        {"joining_month_day": {"$in": month_day_values}},
                    ]
                }
            },
            {
                "$project": {
                    "_id": 1,
                    "employee_id": 1,
                    "full_name": 1,
                    "first_name": 1,
                    "last_name": 1,
                    "avatar_url": 1,
                    "designation": 1,
                    "date_of_birth": 1,
                    "joining_date": 1,
                }
            },
        ]

        return await self.collection.aggregate(pipeline).to_list(length=None)

    async def update(
        self,
        employee_id: str,
        update_data: dict,
        created_by: str | None = None,
    ):
        if not ObjectId.is_valid(employee_id):
            return None

        query = {
            "_id": ObjectId(employee_id),
            "employee_id": {"$exists": True},
        }

        if created_by is not None:
            query["created_by"] = created_by

        await self.collection.update_one(
            query,
            {"$set": update_data},
        )

        return await self.get_by_id(employee_id, created_by=created_by)

    async def update_status(
        self,
        employee_id: str,
        status: str,
        update_data: dict | None = None,
        created_by: str | None = None,
    ):
        if not ObjectId.is_valid(employee_id):
            return None

        changes = dict(update_data or {})
        changes["status"] = status

        query = {
            "_id": ObjectId(employee_id),
            "employee_id": {"$exists": True},
        }

        if created_by is not None:
            query["created_by"] = created_by

        result = await self.collection.update_one(
            query,
            {"$set": changes},
        )

        if result.matched_count == 0:
            return None

        return await self.get_by_id(employee_id, created_by=created_by)

    async def delete(
        self,
        employee_id: str,
        created_by: str | None = None,
    ):
        if not ObjectId.is_valid(employee_id):
            return False

        query = {
            "_id": ObjectId(employee_id),
            "employee_id": {"$exists": True},
        }

        if created_by is not None:
            query["created_by"] = created_by

        result = await self.collection.delete_one(query)
        return result.deleted_count > 0