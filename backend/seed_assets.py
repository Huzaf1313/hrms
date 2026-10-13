"""Seeds demo assets and asset requests against your real employees.

Idempotent: if any asset already exists the script does nothing, so it never
overwrites assets you have since edited or added.

    cd backend
    python seed_assets.py
"""

import asyncio
from datetime import datetime, timedelta, timezone

from app.db.database import database
from app.repositories.asset_repository import AssetRepository
from app.repositories.asset_request_repository import AssetRequestRepository
from app.repositories.department_repository import DepartmentRepository
from app.repositories.employee_repository import EmployeeRepository


# Mirrors the split the dashboard design was drawn against.
CATEGORY_COUNTS = {
    "Laptop": 28,
    "Mobile": 22,
    "Monitor": 18,
    "Accessories": 16,
    "Furniture": 12,
    "Electronics": 10,
    "Software": 8,
    "Others": 6,
}

TARGET_STATUS_COUNTS = {
    "in_use": 94,
    "available": 18,
    "pending_return": 4,
    "maintenance": 4,
}

CATALOGUE = {
    "Laptop": [
        ('Dell Laptop (15.6")', "Dell / Inspiron 15", 78000),
        ("MacBook Pro (14\")", "Apple / MacBook Pro 14", 165000),
        ("HP EliteBook 840", "HP / EliteBook 840", 95000),
        ("Lenovo ThinkPad X1", "Lenovo / ThinkPad X1", 125000),
        ("Acer Aspire 5", "Acer / Aspire 5", 54000),
    ],
    "Mobile": [
        ("Mobile Phone (iPhone 14)", "Apple / iPhone 14", 79900),
        ("Mobile Phone (Galaxy S23)", "Samsung / Galaxy S23", 74999),
        ("Mobile Phone (Pixel 7a)", "Google / Pixel 7a", 44999),
        ("Mobile Phone (OnePlus 11)", "OnePlus / OnePlus 11", 69999),
    ],
    "Monitor": [
        ('Dell Monitor (24")', "Dell / P2422H", 18500),
        ('LG Monitor (27")', "LG / 27UP850", 32000),
        ('HP Monitor (22")', "HP / V22", 14500),
        ('ViewSonic Monitor (24")', "ViewSonic / VA2447", 21000),
    ],
    "Accessories": [
        ("Keyboard", "Logitech / K120", 1200),
        ("LOGITECH Mouse", "Logitech / M350", 1100),
        ("Headset", "Jabra / Evolve 20", 9500),
        ("Webcam", "Logitech / C920", 8500),
        ("Docking Station", "Kensington / K362", 16000),
        ("USB Hub", "Anker / USB-C Hub", 4200),
    ],
    "Furniture": [
        ("Office Chair", "Nilkamal / Ergonomic", 12500),
        ("Study Table", "Godrej / Compact", 9400),
        ("Cabinet", "Steelcase / Ledger", 18000),
        ("Standing Desk", "IKEA / Karlby", 28000),
    ],
    "Electronics": [
        ("Projector", "Epson / EB-X41", 46000),
        ("Conference Speaker", "Jabra / Confluence", 38000),
        ("Whiteboard", "Staedtler / Lumos", 4200),
        ("Camera", "Logitech / Rally", 62000),
    ],
    "Software": [
        ("Windows 11 Pro (License)", "Microsoft / Windows", 14000),
        ("Microsoft 365 (License)", "Microsoft / M365", 7500),
        ("Adobe CC (License)", "Adobe / CC", 32000),
        ("Figma (License)", "Figma / Org", 12000),
        ("Antivirus (1 Year)", "Kaspersky / Std", 2600),
    ],
    "Others": [
        ("ID Card Printer", "Evolve / IDCP", 15500),
        ("First Aid Kit", "Medline / FA-12", 1800),
        ("Fire Extinguisher", "Kidde / KS-10", 2400),
        ("Coffee Vending Pass", "Refresh / Pass", 500),
    ],
}

# Rows written before the generator kicks in, so the first page of the table
# shows recognisable assets instead of pure noise.
SEED_ROWS = [
    ("Dell Laptop (15.6\")", "Laptop", "Dell / Inspiron 15", "in_use", "2023-04-12"),
    ("LOGITECH Mouse", "Accessories", "Logitech / M350", "in_use", "2024-02-05"),
    ('Dell Monitor (24")', "Monitor", "Dell / P2422H", "in_use", "2023-11-20"),
    ("Office Chair", "Furniture", "Nilkamal / Ergonomic", "in_use", "2022-08-01"),
    ("Mobile Phone (iPhone 14)", "Mobile", "Apple / iPhone 14", "pending_return", "2023-01-15"),
    ("Keyboard", "Accessories", "Logitech / K120", "available", None),
    ("Projector", "Electronics", "Epson / EB-X41", "available", None),
]

REQUEST_SEEDS = [
    ("issue", "pending", "Laptop"),
    ("issue", "approved", "Accessories"),
    ("return", "pending", "Monitor"),
    ("return", "rejected", "Accessories"),
    ("return", "approved", "Laptop"),
]


def create_random(seed: int):
    """Linear congruential generator so the seeded data is stable per run."""

    state = seed

    def next_random():
        nonlocal state
        state = (state * 1664525 + 1013904223) % 4294967296
        return state / 4294967296

    return next_random


def shuffle(items, random):
    for index in range(len(items) - 1, 0, -1):
        swap = int(random() * (index + 1))
        items[index], items[swap] = items[swap], items[index]

    return items


def _date(value: str | None):
    if value is None:
        return None

    return datetime.strptime(value, "%Y-%m-%d")


def _short_label(name: str, brand_model: str) -> str:
    """Condense an asset to the "Product (Brand)" form the request list shows.

    'Dell Laptop (15.6")' + 'Dell / Inspiron 15' -> 'Laptop (Dell)'. The full
    name is far too long for the one-line request description.
    """

    product = name.split(" (")[0].split()[-1]
    brand = brand_model.split(" / ")[0]

    return f"{product} ({brand})"


async def seed_assets():
    assets = database["assets"]
    requests = database["asset_requests"]

    asset_repository = AssetRepository()
    request_repository = AssetRequestRepository()
    employee_repository = EmployeeRepository()
    department_repository = DepartmentRepository()

    await asset_repository.ensure_indexes()
    await request_repository.ensure_indexes()

    existing = await assets.count_documents({})

    if existing:
        print(f"Skipped: {existing} asset(s) already in the database.")
        print("Delete them from MongoDB first if you want to reseed.")
        return

    employees = await employee_repository.get_all({}, 0, 10000)

    if not employees:
        print("No employees found in the users collection.")
        print("Add at least one employee before seeding assets.")
        return

    departments = await department_repository.get_all({}, 0, 1000)
    departments_by_id = {str(department["_id"]): department for department in departments}

    for employee in employees:
        employee["_department_name"] = departments_by_id.get(
            str(employee.get("department_id")), {}
        ).get("name")

    random = create_random(20250519)
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    def holder():
        return employees[int(random() * len(employees))]

    documents = []

    for index, (name, category, brand_model, status, issue_date) in enumerate(SEED_ROWS):
        assigned = holder() if status in ("in_use", "pending_return") else None
        purchased = _date(issue_date) or (now - timedelta(days=random() * 900 + 30))

        documents.append(
            _build(
                sequence=index + 1,
                name=name,
                category=category,
                brand_model=brand_model,
                status=status,
                employee=assigned,
                issue_date=_date(issue_date),
                purchase_date=purchased,
                now=now,
                random=random,
            )
        )

    remaining = sum(CATEGORY_COUNTS.values()) - len(SEED_ROWS)

    category_pool = [
        category
        for category, count in CATEGORY_COUNTS.items()
        for _ in range(max(0, count - sum(1 for row in SEED_ROWS if row[1] == category)))
    ][:remaining]

    # Budget the seeded rows out of the target split rather than slicing a flat
    # pool: concatenating every status and truncating the tail would silently
    # drop the rarest statuses (maintenance and pending_return) entirely.
    status_budget = dict(TARGET_STATUS_COUNTS)

    for row in SEED_ROWS:
        status_budget[row[3]] = max(0, status_budget[row[3]] - 1)

    status_pool = [
        status for status, count in status_budget.items() for _ in range(count)
    ]

    shuffle(category_pool, random)
    shuffle(status_pool, random)

    for offset, (category, status) in enumerate(zip(category_pool, status_pool)):
        catalogue = CATALOGUE[category]
        name, brand_model, cost = catalogue[int(random() * len(catalogue))]
        assigned = holder() if status in ("in_use", "pending_return") else None

        documents.append(
            _build(
                sequence=len(SEED_ROWS) + offset + 1,
                name=name,
                category=category,
                brand_model=brand_model,
                status=status,
                employee=assigned,
                issue_date=None,
                purchase_date=now - timedelta(days=int(random() * 900) + 30),
                cost=cost,
                now=now,
                random=random,
            )
        )

    await assets.insert_many(documents)

    # Point the id counters past what was just written so the API never reuses
    # a tag the seed already handed out.
    await database["counters"].update_one(
        {"_id": "asset_tag"},
        {"$max": {"value": len(documents)}},
        upsert=True,
    )

    print(f"Created {len(documents)} assets across {len(CATEGORY_COUNTS)} categories.")

    created_requests = 0
    # Keyed by category, not by asset name: catalogue names carry the brand and
    # screen size ("Dell Laptop (15.6")"), so matching on them would silently
    # drop most of the request seeds.
    by_category: dict[str, dict] = {}

    for document in documents:
        by_category.setdefault(document["category"], document)

    for index, (request_type, status, category) in enumerate(REQUEST_SEEDS):
        asset = by_category.get(category)

        if not asset:
            continue

        employee = holder()

        await requests.insert_one(
            {
                "request_tag": f"REQ-{index + 1:03d}",
                "request_type": request_type,
                "asset_id": str(asset["_id"]),
                "asset_tag": asset["asset_tag"],
                "asset_name": asset["name"],
                "employee_id": employee["employee_id"],
                "employee_name": employee.get("full_name") or employee["employee_id"],
                "detail": _short_label(asset["name"], asset["brand_model"]),
                "reason": None,
                "status": status,
                "requested_at": now - timedelta(days=index + 1),
                "reviewed_at": None if status == "pending" else now - timedelta(days=index),
                "reviewed_by": None if status == "pending" else "seed",
                "admin_note": None,
                "created_at": now - timedelta(days=index + 1),
                "updated_at": now - timedelta(days=index + 1),
            }
        )
        created_requests += 1

    await database["counters"].update_one(
        {"_id": "asset_request"},
        {"$max": {"value": created_requests}},
        upsert=True,
    )

    print(f"Created {created_requests} asset requests.")
    print("\nAsset setup completed.")


def _build(
    sequence: int,
    name: str,
    category: str,
    brand_model: str,
    status: str,
    employee: dict | None,
    issue_date: datetime | None,
    purchase_date: datetime,
    now: datetime,
    random,
    cost: int | None = None,
):
    if cost is None:
        catalogue = CATALOGUE[category]
        cost = catalogue[int(random() * len(catalogue))][2]

    return {
        "asset_tag": f"AST-{sequence:03d}",
        "name": name,
        "category": category,
        "brand_model": brand_model,
        "serial_number": f"SN{sequence:05d}{int(random() * 9000) + 1000}",
        "status": status,
        "assigned_to_employee_id": employee["employee_id"] if employee else None,
        "assigned_to_name": (
            (employee.get("full_name") or employee["employee_id"]) if employee else None
        ),
        "department_id": employee.get("department_id") if employee else None,
        "department_name": employee.get("_department_name") if employee else None,
        "issue_date": issue_date,
        "returned_at": None,
        "purchase_date": purchase_date,
        "purchase_cost": float(cost),
        "vendor": "Amazon Business" if random() > 0.5 else "Croma",
        "warranty_expiry": purchase_date + timedelta(days=365 * 3),
        "notes": None,
        "created_by": "seed",
        "created_at": now,
        "updated_at": now,
    }


if __name__ == "__main__":
    asyncio.run(seed_assets())