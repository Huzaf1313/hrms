"""Move every employee ID forward by one, freeing AAR001 for the super admin.

AAR001 -> AAR002, AAR002 -> AAR003, and so on. Gaps are kept. Dry-run by
default:

    python shift_employee_ids.py
    python shift_employee_ids.py --apply

Run it once only: a second --apply would shift everyone again. The script
refuses to run when AAR001 is already free.

Object-storage keys and document file names that happen to contain the old
code are left alone on purpose - they are pointers to files that already
exist under that name, and those files still open normally.
"""

import asyncio
import re
import sys
from datetime import datetime, timezone

from app.db.database import close_database_connection, connect_to_database, database


CODE = re.compile(r"\bAAR(\d{3,})\b")

# Every field that stores an employee code by value.
REFERENCE_FIELDS = (
    ("activity_events", "employee_id"),
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


def shifted(code: str) -> str:
    return f"AAR{int(CODE.fullmatch(code).group(1)) + 1:03d}"


async def main(apply: bool) -> None:
    await connect_to_database()

    try:
        users = database["users"]
        employees = await users.find(
            {"employee_id": {"$regex": r"^AAR\d{3,}$"}}
        ).to_list(length=None)

        # Highest first, so a moved ID never lands on one still in use.
        employees.sort(key=lambda user: int(user["employee_id"][3:]), reverse=True)
        mapping = [
            {
                "user_id": user["_id"],
                "old_id": user["employee_id"],
                "new_id": shifted(user["employee_id"]),
            }
            for user in employees
        ]
        old_to_new = {item["old_id"]: item["new_id"] for item in mapping}

        if "AAR001" not in old_to_new:
            print("AAR001 is not held by any employee - nothing to do.")
            return

        sequence = await database["sequences"].find_one({"_id": "employee_id"})
        print(f"Shifting {len(mapping)} employee ID(s):")
        for item in reversed(mapping):
            print(f"  {item['old_id']} -> {item['new_id']}")
        print(f"Sequence: {sequence['value'] if sequence else 0} -> +1")

        for collection_name, field in REFERENCE_FIELDS:
            count = await database[collection_name].count_documents(
                {field: {"$in": list(old_to_new)}}
            )
            if count:
                print(f"  {collection_name}.{field}: {count} document(s)")

        if not apply:
            print("\nDry run only. Re-run with --apply to make changes.")
            return

        await database["employee_id_migrations"].insert_one(
            {
                "_id": "shift_" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),
                "created_at": datetime.now(timezone.utc),
                "kind": "shift_forward_by_one",
                "mapping": mapping,
            }
        )

        for item in mapping:
            await users.update_one(
                {"_id": item["user_id"]},
                {"$set": {"employee_id": item["new_id"]}},
            )

            for collection_name, field in REFERENCE_FIELDS:
                await database[collection_name].update_many(
                    {field: item["old_id"]},
                    {"$set": {field: item["new_id"]}},
                )

        async for announcement in database["announcements"].find(
            {"target_employees": {"$exists": True}}
        ):
            targets = announcement.get("target_employees") or []
            replacement = [old_to_new.get(target, target) for target in targets]
            if replacement != targets:
                await database["announcements"].update_one(
                    {"_id": announcement["_id"]},
                    {"$set": {"target_employees": replacement}},
                )

        # Activity feed lines quote the code, e.g. "... was added (AAR001)".
        async for event in database["activity_events"].find(
            {"text": {"$regex": r"AAR\d{3,}"}}
        ):
            text = CODE.sub(
                lambda match: old_to_new.get(match.group(0), match.group(0)),
                event["text"],
            )
            if text != event["text"]:
                await database["activity_events"].update_one(
                    {"_id": event["_id"]},
                    {"$set": {"text": text}},
                )

        await database["sequences"].update_one(
            {"_id": "employee_id"},
            {"$inc": {"value": 1}},
            upsert=True,
        )

        print("\nEmployee IDs shifted successfully.")
    finally:
        await close_database_connection()


if __name__ == "__main__":
    asyncio.run(main(apply="--apply" in sys.argv))
