"""Minting employee identities for employee accounts.

Employees are not a separate collection: an account becomes an employee by
carrying an employee_id, and every employee-facing query filters on that
field. The bootstrapped HR account is created as a pure login document
without one, so until a code is minted the HR is invisible to attendance,
employee lists and summaries. This module mints the code (and the
first/last name shape those lists read) exactly once per account.

Codes use one atomic sequence and are formatted as AAR001, AAR002, and so on.
"""

from datetime import datetime

from pymongo import ReturnDocument

from app.core.exceptions import AppException
from app.core.roles import UserRole

async def next_employee_code(collection) -> str:
    """Atomically allocate the next employee code.

    Gaps are intentionally preserved when an employee is deleted. This avoids
    duplicate IDs when multiple employees are created concurrently.
    """
    sequence = await collection.database["sequences"].find_one_and_update(
        {"_id": "employee_id"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    return f"AAR{sequence['value']:03d}"


async def backfill_minted_profiles(users_collection) -> int:
    """Fill joining_date for employee records minted before the field was
    part of the mint. The Employees list serializes joining_date as a
    required date, so a minted record without one breaks the page with a
    500. Login accounts join when they were created. Idempotent.
    """
    filled = 0

    async for user in users_collection.find({"employee_id": {"$exists": True}}):
        if user.get("joining_date"):
            continue

        joined = user.get("created_at")

        if not isinstance(joined, datetime):
            joined = datetime.utcnow()

        result = await users_collection.update_one(
            {"_id": user["_id"], "joining_date": None},
            {"$set": {"joining_date": datetime(joined.year, joined.month, joined.day)}},
        )

        if result.matched_count:
            filled += 1

    return filled


def split_full_name(full_name: str) -> tuple[str, str]:
    """Employee lists read first_name/last_name; login accounts store
    full_name. Split on the first space so "Ravan Sam" renders as a normal
    employee everywhere."""
    parts = (full_name or "").strip().split()

    if not parts:
        return "HR", ""

    if len(parts) == 1:
        return parts[0], ""

    return parts[0], " ".join(parts[1:])


async def ensure_employee_profile(collection, user: dict) -> dict:
    """Return `user` as an employee record, minting its employee identity
    when the account has none yet.

    Idempotent: accounts that already carry an employee_id pass straight
    through. The guarded update (employee_id must still be absent) plus a
    re-read keeps two concurrent first punches from double-minting - the
    loser picks up the winner's code.
    """
    if user.get("employee_id"):
        return user

    # The super admin is deliberately never an employee. Employee routes only
    # see accounts that carry an employee_id, and the employee update path
    # can reset a password and rewrite the role - so minting one here would
    # let HR take over the account that is meant to sit above HR.
    if getattr(user.get("role"), "value", user.get("role")) == UserRole.SUPER_ADMIN.value:
        return user

    user_id = user.get("_id")

    if user_id is None:
        raise AppException("No employee record found for this account", 404)

    first_name, last_name = split_full_name(user.get("full_name", ""))
    now = datetime.utcnow()

    # The Employees list serializes joining_date as a required date, so a
    # minted record without one would 500 the page. Login accounts join when
    # they were created.
    joined = user.get("created_at")

    if not isinstance(joined, datetime):
        joined = now

    joining_date = datetime(joined.year, joined.month, joined.day)

    for _ in range(5):
        code = await next_employee_code(collection)

        result = await collection.update_one(
            {
                "_id": user_id,
                "employee_id": {"$exists": False},
            },
            {
                "$set": {
                    "employee_id": code,
                    "first_name": first_name,
                    "last_name": last_name,
                    "joining_date": joining_date,
                    "updated_at": now,
                }
            },
        )

        if result.matched_count:
            return await collection.find_one({"_id": user_id})

        # Lost the race - the account has a code now, use it.
        user = await collection.find_one({"_id": user_id})

        if user and user.get("employee_id"):
            return user

    raise AppException("Could not allocate an employee code", 500)
