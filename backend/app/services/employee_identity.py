"""Minting employee identities for admin accounts.

Employees are not a separate collection: an account becomes an employee by
carrying an employee_id, and every employee-facing query filters on that
field. The bootstrapped HR account is created as a pure login document
without one, so until a code is minted the HR is invisible to attendance,
employee lists and summaries. This module mints the code (and the
first/last name shape those lists read) exactly once per account.

Codes follow the account's role: HR accounts mint HRxxx, other accounts
mint EMPxxx, each sequence counting up from its own highest existing code.
"""

import re
from datetime import datetime

from app.core.exceptions import AppException

_CODE_PATTERN = re.compile(r"^(?P<prefix>EMP|HR)(?P<number>\d+)$")
_LEGACY_EMP_CODE_PATTERN = re.compile(r"^EMP\d+$")


async def _next_employee_code(collection, prefix: str) -> str:
    """One past the highest existing code with this prefix, zero-padded to
    three digits. Scanning instead of counting keeps codes stable when
    low-numbered employees are deleted."""
    highest = 0
    pattern = re.compile(f"^{re.escape(prefix)}\\d+$")

    async for doc in collection.find(
        {"employee_id": {"$regex": pattern}},
        {"employee_id": 1},
    ):
        match = _CODE_PATTERN.match(doc.get("employee_id") or "")

        if not match or match.group("prefix") != prefix:
            continue

        highest = max(highest, int(match.group("number")))

    return f"{prefix}{highest + 1:03d}"


async def migrate_legacy_hr_codes(
    users_collection,
    attendance_collection,
    regularization_collection,
) -> list[tuple[str, str]]:
    """Repair HR accounts whose identity was minted while the EMP-only prefix
    was live. Moves the legacy code onto the HR sequence and drops the
    historical attendance records so the HR starts with a clean slate under a
    properly prefixed employee id.
    """
    migrated: list[tuple[str, str]] = []

    async for user in users_collection.find({"role": "hr_admin"}):
        legacy_code = user.get("employee_id") or ""

        if not _LEGACY_EMP_CODE_PATTERN.match(legacy_code):
            continue

        new_code = await _next_employee_code(users_collection, "HR")

        result = await users_collection.update_one(
            {"_id": user["_id"], "employee_id": legacy_code},
            {"$set": {"employee_id": new_code, "updated_at": datetime.utcnow()}},
        )

        if not result.matched_count:
            continue

        await attendance_collection.delete_many({"employee_id": legacy_code})
        await regularization_collection.delete_many({"employee_id": legacy_code})

        migrated.append((legacy_code, new_code))

    return migrated


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

    user_id = user.get("_id")

    if user_id is None:
        raise AppException("No employee record found for this account", 404)

    role = getattr(user.get("role"), "value", user.get("role"))
    prefix = "HR" if role == "hr_admin" else "EMP"

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
        code = await _next_employee_code(collection, prefix)

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
