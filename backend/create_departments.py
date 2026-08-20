import asyncio

from app.db.database import database


DEPARTMENTS = [
    {
        "name": "Operation",
        "description": "Operations Department",
    },
    {
        "name": "Development",
        "description": "Software Development Department",
    },
    {
        "name": "UI/UX",
        "description": "UI/UX Design Department",
    },
    {
        "name": "Social Media",
        "description": "Social Media Department",
    },
]


async def create_departments():
    collection = database["departments"]

    for department in DEPARTMENTS:
        existing = await collection.find_one({
            "name": department["name"]
        })

        if existing:
            print(f"Already exists: {department['name']}")
            continue

        await collection.insert_one(department)
        print(f"Created: {department['name']}")

    print("Department setup completed.")


if __name__ == "__main__":
    asyncio.run(create_departments())