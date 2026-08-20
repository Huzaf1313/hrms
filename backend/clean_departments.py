import asyncio

from app.db.database import database


async def clean_departments():
    collection = database["departments"]

    # Remove test department
    await collection.delete_many({
        "name": "test department"
    })

    # Find all Human Resources departments
    hr_departments = await collection.find({
        "name": "Human Resources"
    }).to_list(length=None)

    # Keep the first HR department and remove duplicates
    if len(hr_departments) > 1:
        ids_to_delete = [
            department["_id"]
            for department in hr_departments[1:]
        ]

        await collection.delete_many({
            "_id": {"$in": ids_to_delete}
        })

    print("Departments cleaned successfully.")


if __name__ == "__main__":
    asyncio.run(clean_departments())