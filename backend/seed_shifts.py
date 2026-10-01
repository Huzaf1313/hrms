"""Seeds the default shift master list.

Idempotent: re-running only fills in shifts that are missing, and never
touches shifts an admin has edited or added.

    cd backend
    python seed_shifts.py
"""

import asyncio
from datetime import datetime

from app.db.database import database


SHIFTS = [
    {
        # Kept because thousands of existing attendance records already carry
        # shift = "General".
        "name": "General",
        "start_time": "09:30",
        "end_time": "18:30",
        "is_active": True,
        "notes": "Default shift. Retained for existing attendance records.",
    },
    {
        "name": "Morning",
        "start_time": "09:00",
        "end_time": "18:00",
        "is_active": True,
        "notes": "Morning shift, 9 hours.",
    },
    {
        "name": "Night",
        "start_time": "18:30",
        "end_time": "03:30",
        "is_active": True,
        "notes": "Night shift, 9 hours. Ends on the following day.",
    },
]


async def seed_shifts():
    collection = database["shifts"]

    await collection.create_index(
        [("name", 1)],
        unique=True,
        name="unique_shift_name",
    )

    created = 0
    skipped = 0

    for shift in SHIFTS:
        existing = await collection.find_one({"name": shift["name"]})

        if existing:
            print(f"Already exists: {shift['name']}")
            skipped += 1
            continue

        await collection.insert_one({**shift, "created_at": datetime.utcnow()})
        print(f"Created: {shift['name']} ({shift['start_time']} - {shift['end_time']})")
        created += 1

    print(f"\nShift setup completed. Created: {created}, skipped: {skipped}")
    print("Add any further shifts (e.g. part-time) from the Manage Shifts screen.")


if __name__ == "__main__":
    asyncio.run(seed_shifts())
