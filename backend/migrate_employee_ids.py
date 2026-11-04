"""Convert existing employee IDs to the AAR### format.

This migration is intentionally dry-run by default:

    python migrate_employee_ids.py
    python migrate_employee_ids.py --apply

Take a MongoDB backup before applying. The migration temporarily replaces the
IDs on user documents so a new ID cannot collide with an old one, then updates
all employee-code references before restoring the final AAR### values.
"""

import asyncio
import sys
from datetime import datetime, timezone

from app.db.database import close_database_connection, connect_to_database, database


EMPLOYEE_FILTER = {
    "$or": [
        {"employee_id": {"$exists": True}},
        {"role": {"$in": ["employee", "hr_admin"]}},
    ]
}

REFERENCE_FIELDS = (
    ("employee_attendance", "employee_id"),
    ("employee_attendance_regularization", "employee_id"),
    ("employee_leave", "employee_id"),
    ("employee_payroll", "employee_id"),
    ("employee_documents", "employee_id"),
    ("assets", "assigned_to_employee_id"),
    ("asset_requests", "employee_id"),
    ("exit_requests", "employee_id"),
    ("notifications", "employee_id"),
    ("employee_support_tickets", "employee_id"),
)


async def load_employees() -> list[dict]:
    cursor = database["users"].find(EMPLOYEE_FILTER).sort(
        [("created_at", 1), ("_id", 1)]
    )
    return await cursor.to_list(length=None)


def build_mapping(employees: list[dict]) -> list[dict]:
    mapping = []
    old_ids: dict[str, str] = {}

    for number, employee in enumerate(employees, start=1):
        old_id = (employee.get("employee_id") or "").strip()
        user_id = str(employee["_id"])

        if old_id:
            previous_user = old_ids.get(old_id)
            if previous_user and previous_user != user_id:
                raise RuntimeError(
                    f"Duplicate employee_id {old_id!r} on users "
                    f"{previous_user} and {user_id}"
                )
            old_ids[old_id] = user_id

        mapping.append(
            {
                "user_id": employee["_id"],
                "old_id": old_id or None,
                "new_id": f"AAR{number:03d}",
                "name": employee.get("full_name") or "",
            }
        )

    return mapping


async def update_reference_collection(collection_name: str, field: str, ids: dict):
    collection = database[collection_name]
    updated = 0

    for old_id, new_id in ids.items():
        result = await collection.update_many(
            {field: old_id},
            {"$set": {field: new_id}},
        )
        updated += result.modified_count

    return updated


async def update_announcement_targets(ids: dict) -> int:
    updated = 0
    collection = database["announcements"]

    async for announcement in collection.find(
        {"target_employees": {"$exists": True}}
    ):
        targets = announcement.get("target_employees") or []
        replacement = [ids.get(target, target) for target in targets]

        if replacement == targets:
            continue

        result = await collection.update_one(
            {"_id": announcement["_id"]},
            {"$set": {"target_employees": replacement}},
        )
        updated += result.modified_count

    return updated


async def apply_mapping(mapping: list[dict]) -> None:
    users = database["users"]
    migration_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    old_to_new = {
        item["old_id"]: item["new_id"]
        for item in mapping
        if item["old_id"]
    }

    await database["employee_id_migrations"].insert_one(
        {
            "_id": migration_id,
            "created_at": datetime.now(timezone.utc),
            "mapping": mapping,
        }
    )

    for item in mapping:
        await users.update_one(
            {"_id": item["user_id"]},
            {"$set": {"employee_id": f"__AAR_MIGRATION__{item['user_id']}"}},
        )

    for collection_name, field in REFERENCE_FIELDS:
        await update_reference_collection(collection_name, field, old_to_new)

    await update_announcement_targets(old_to_new)

    for item in mapping:
        await users.update_one(
            {"_id": item["user_id"]},
            {"$set": {"employee_id": item["new_id"]}},
        )

    await database["sequences"].update_one(
        {"_id": "employee_id"},
        {"$max": {"value": len(mapping)}},
        upsert=True,
    )
    await users.create_index(
        "employee_id",
        unique=True,
        sparse=True,
        name="unique_employee_id",
    )


async def main(apply: bool) -> None:
    await connect_to_database()

    try:
        employees = await load_employees()
        mapping = build_mapping(employees)
        old_ids = {item["old_id"] for item in mapping if item["old_id"]}

        print(f"Found {len(mapping)} employee profile(s)")
        print(f"Converting {len(old_ids)} existing employee ID(s)")
        print(f"Assigning IDs from AAR001 through AAR{len(mapping):03d}")

        for item in mapping:
            print(
                f"  {item['old_id'] or '(missing)':>16} -> "
                f"{item['new_id']}  {item['name']}"
            )

        if not apply:
            print("\nDry run only. Re-run with --apply to make changes.")
            return

        await apply_mapping(mapping)
        print("\nEmployee ID migration applied successfully.")
    finally:
        await close_database_connection()


if __name__ == "__main__":
    asyncio.run(main(apply="--apply" in sys.argv))
