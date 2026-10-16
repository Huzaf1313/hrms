"""One-off backfill: resolve reporting_manager names to manager_id.

Employees used to store their manager as a display name only. Manager
visibility is now keyed on manager_id, so existing records need the id
stamped on them or those managers will see an empty team.

Run once:  python backfill_manager_ids.py
Dry run:   python backfill_manager_ids.py --dry-run
"""
import asyncio
import sys

from app.db.database import close_database_connection, connect_to_database
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.user_repository import UserRepository


async def main(dry_run: bool) -> None:
    await connect_to_database()

    employees = EmployeeRepository()
    users = UserRepository()

    admin_accounts = await users.get_admin_accounts()
    by_name = {
        (user.get("full_name") or "").strip().lower(): str(user["_id"])
        for user in admin_accounts
    }

    unassigned = 0
    updated = 0
    skipped = 0

    cursor = employees.collection.find(
        {
            "employee_id": {"$exists": True},
            "reporting_manager": {"$nin": [None, ""]},
            "$or": [
                {"manager_id": {"$exists": False}},
                {"manager_id": None},
            ],
        }
    )

    async for employee in cursor:
        name = (employee.get("reporting_manager") or "").strip()
        manager_id = by_name.get(name.lower())

        if not manager_id:
            unassigned += 1
            print(
                f"  unmatched: {employee.get('employee_id')} "
                f"-> {name!r}"
            )
            continue

        if not dry_run:
            await employees.collection.update_one(
                {"_id": employee["_id"]},
                {"$set": {"manager_id": manager_id}},
            )

        updated += 1

    await employees.ensure_indexes()

    verb = "would update" if dry_run else "updated"
    print(f"\n{verb} {updated} employee(s)")
    print(f"{unassigned} could not be matched - assign them in the UI")

    if unassigned:
        print("\nKnown manager accounts:")
        for user in admin_accounts:
            print(f"  {user.get('full_name')}  ({user['role']})")

    await close_database_connection()


if __name__ == "__main__":
    asyncio.run(main(dry_run="--dry-run" in sys.argv))