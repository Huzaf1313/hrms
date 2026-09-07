from datetime import date, datetime, time

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING

from app.db.database import database


class EmployeePayrollRepository:
    collection = database["employee_payroll"]

    @staticmethod
    def date_to_datetime(value: date) -> datetime:
        return datetime.combine(
            value,
            time.min,
        )

    async def ensure_indexes(self):
        await self.collection.create_index(
            [
                ("employee_id", ASCENDING),
                ("pay_period_start", DESCENDING),
            ],
            name="employee_payroll_employee_period_index",
        )

        await self.collection.create_index(
            [
                ("employee_id", ASCENDING),
                ("month", DESCENDING),
            ],
            name="employee_payroll_employee_month_index",
        )

        await self.collection.create_index(
            [
                ("payment.status", ASCENDING),
                ("payment.paid_on", DESCENDING),
            ],
            name="employee_payroll_payment_status_index",
        )

    async def create(
        self,
        payroll_data: dict,
    ):
        if isinstance(
            payroll_data.get("pay_period_start"),
            date,
        ):
            payroll_data["pay_period_start"] = (
                self.date_to_datetime(
                    payroll_data["pay_period_start"]
                )
            )

        if isinstance(
            payroll_data.get("pay_period_end"),
            date,
        ):
            payroll_data["pay_period_end"] = (
                self.date_to_datetime(
                    payroll_data["pay_period_end"]
                )
            )

        payment = payroll_data.get("payment")

        if payment and isinstance(
            payment.get("paid_on"),
            date,
        ):
            payment["paid_on"] = self.date_to_datetime(
                payment["paid_on"]
            )

        result = await self.collection.insert_one(
            payroll_data
        )

        return await self.get_by_id(
            str(result.inserted_id)
        )

    async def get_by_id(
        self,
        payroll_id: str,
    ):
        if not ObjectId.is_valid(payroll_id):
            return None

        return await self.collection.find_one(
            {
                "_id": ObjectId(payroll_id)
            }
        )

    async def get_by_employee(
        self,
        employee_id: str,
        skip: int = 0,
        limit: int = 100,
    ):
        cursor = (
            self.collection
            .find(
                {
                    "employee_id": employee_id,
                }
            )
            .sort(
                "pay_period_start",
                DESCENDING,
            )
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(
            length=limit
        )

    async def count_by_employee(
        self,
        employee_id: str,
    ):
        return await self.collection.count_documents(
            {
                "employee_id": employee_id,
            }
        )

    async def get_latest_by_employee(
        self,
        employee_id: str,
    ):
        return await self.collection.find_one(
            {
                "employee_id": employee_id,
            },
            sort=[
                (
                    "pay_period_start",
                    DESCENDING,
                )
            ],
        )

    async def get_by_employee_and_period(
        self,
        employee_id: str,
        pay_period_start: datetime,
        pay_period_end: datetime,
    ):
        return await self.collection.find_one(
            {
                "employee_id": employee_id,
                "pay_period_start": pay_period_start,
                "pay_period_end": pay_period_end,
            }
        )

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

    async def update(
        self,
        payroll_id: str,
        update_data: dict,
    ):
        if not ObjectId.is_valid(payroll_id):
            return None

        if isinstance(
            update_data.get("pay_period_start"),
            date,
        ):
            update_data["pay_period_start"] = (
                self.date_to_datetime(
                    update_data["pay_period_start"]
                )
            )

        if isinstance(
            update_data.get("pay_period_end"),
            date,
        ):
            update_data["pay_period_end"] = (
                self.date_to_datetime(
                    update_data["pay_period_end"]
                )
            )

        payment = update_data.get("payment")

        if payment and isinstance(
            payment.get("paid_on"),
            date,
        ):
            payment["paid_on"] = self.date_to_datetime(
                payment["paid_on"]
            )

        await self.collection.update_one(
            {
                "_id": ObjectId(payroll_id)
            },
            {
                "$set": update_data
            },
        )

        return await self.get_by_id(
            payroll_id
        )