from datetime import date, datetime, time

from bson import ObjectId
from pymongo import DESCENDING

from app.db.database import database


class AdminPayslipRepository:
    collection = database["employee_payroll"]

    @staticmethod
    def date_to_datetime(value: date) -> datetime:
        return datetime.combine(value, time.min)

    async def create(self, payroll_data: dict):
        data = payroll_data.copy()

        if isinstance(data.get("pay_period_start"), date):
            data["pay_period_start"] = self.date_to_datetime(
                data["pay_period_start"]
            )

        if isinstance(data.get("pay_period_end"), date):
            data["pay_period_end"] = self.date_to_datetime(
                data["pay_period_end"]
            )

        payment = data.get("payment")

        if payment and isinstance(payment.get("paid_on"), date):
            payment["paid_on"] = self.date_to_datetime(
                payment["paid_on"]
            )

        now = datetime.utcnow()

        data["created_at"] = now
        data["updated_at"] = now

        result = await self.collection.insert_one(data)

        return await self.get_by_id(str(result.inserted_id))

    async def get_by_id(self, payroll_id: str):
        if not ObjectId.is_valid(payroll_id):
            return None

        return await self.collection.find_one(
            {"_id": ObjectId(payroll_id)}
        )

    async def get_by_employee(self, employee_id: str):
        cursor = (
            self.collection
            .find({"employee_id": employee_id})
            .sort("pay_period_start", DESCENDING)
        )

        return await cursor.to_list(length=100)

    async def get_by_employee_and_month(
        self,
        employee_id: str,
        month: str,
    ):
        return await self.collection.find_one(
            {
                "employee_id": employee_id,
                "month": month,
            }
        )

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
    ):
        cursor = (
            self.collection
            .find({})
            .sort("pay_period_start", DESCENDING)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def count(self):
        return await self.collection.count_documents({})