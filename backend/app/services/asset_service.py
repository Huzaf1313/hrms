import re
from datetime import date, datetime, timezone

from pymongo.errors import DuplicateKeyError

from app.core.exceptions import AppException
from app.repositories.asset_repository import AssetRepository
from app.repositories.asset_request_repository import AssetRequestRepository
from app.repositories.department_repository import DepartmentRepository
from app.repositories.employee_repository import EmployeeRepository
from app.schemas.asset import (
    ASSET_CATEGORY_ORDER,
    ASSET_STATUS_ORDER,
    AssetCategory,
    AssetStatus,
)
from app.utils.pagination import PaginationParams

# Mongo/BSON stores datetime, never a bare date. Every date-only field on an
# asset is therefore written at midnight and read back as a date.
def to_datetime(value: date | None) -> datetime | None:
    if value is None:
        return None

    return datetime(value.year, value.month, value.day)


def _now() -> datetime:
    """Naive UTC, matching the shape to_datetime writes."""

    return datetime.now(timezone.utc).replace(tzinfo=None)


def _month_bounds() -> tuple[datetime, datetime]:
    now = _now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    if month_start.month == 12:
        month_end = month_start.replace(year=month_start.year + 1, month=1)
    else:
        month_end = month_start.replace(month=month_start.month + 1)

    return month_start, month_end


class AssetService:
    def __init__(self):
        self.repository = AssetRepository()
        self.request_repository = AssetRequestRepository()
        self.employee_repository = EmployeeRepository()
        self.department_repository = DepartmentRepository()

    # ---------------------------------------------------------------- Helpers

    async def _department_name(self, department_id: str | None) -> str | None:
        if not department_id:
            return None

        department = await self.department_repository.get_by_id(department_id)

        return department.get("name") if department else None

    async def _resolve_employee(self, employee_id: str):
        """Look an employee up by their business code (EMP001, not a Mongo id)."""

        employee = await self.employee_repository.get_by_employee_id(employee_id)

        if not employee:
            raise AppException("Employee not found", 404)

        return {
            "employee_id": employee["employee_id"],
            "full_name": employee.get("full_name")
            or " ".join(
                part
                for part in (
                    employee.get("first_name"),
                    employee.get("last_name"),
                )
                if part
            )
            or employee["employee_id"],
            "department_id": employee.get("department_id"),
            "department_name": await self._department_name(
                employee.get("department_id")
            ),
        }

    def _assignment_fields(self, employee: dict | None) -> dict:
        """Fields that change when an asset moves in or out of someone's hands."""

        if not employee:
            return {
                "assigned_to_employee_id": None,
                "assigned_to_name": None,
                "department_id": None,
                "department_name": None,
            }

        return {
            "assigned_to_employee_id": employee["employee_id"],
            "assigned_to_name": employee["full_name"],
            "department_id": employee["department_id"],
            "department_name": employee["department_name"],
        }

    async def _employee_and_department_index(self) -> tuple[dict, dict]:
        """Fetch every employee and department once.

        The allocation table needs to turn dozens of employee codes into names
        and department names; doing that one lookup at a time is the N+1 the
        dashboard would otherwise pay on every render.
        """

        employees = await self.employee_repository.get_all({}, 0, 10000)
        departments = await self.department_repository.get_all({}, 0, 1000)

        return (
            {employee["employee_id"]: employee for employee in employees},
            {str(department["_id"]): department for department in departments},
        )

    # ------------------------------------------------------------------ Create

    async def create_asset(self, data: dict, created_by: str | None):
        now = _now()
        employee_id = data.get("assigned_to_employee_id")
        employee = await self._resolve_employee(employee_id) if employee_id else None

        sequence = await self.repository.next_sequence("asset_tag")
        asset_tag = f"AST-{sequence:03d}"

        # An asset recorded with a holder is in use by definition, whatever
        # status the caller sent along with it.
        status = AssetStatus.IN_USE if employee else data.get("status", AssetStatus.AVAILABLE)

        asset_data = {
            "asset_tag": asset_tag,
            "name": data["name"].strip(),
            "category": data["category"].value
            if isinstance(data["category"], AssetCategory)
            else data["category"],
            "brand_model": data.get("brand_model"),
            "serial_number": data.get("serial_number"),
            "status": status.value if isinstance(status, AssetStatus) else status,
            **self._assignment_fields(employee),
            "issue_date": to_datetime(data.get("issue_date")),
            "returned_at": None,
            "purchase_date": to_datetime(data.get("purchase_date")),
            "purchase_cost": data.get("purchase_cost"),
            "vendor": data.get("vendor"),
            "warranty_expiry": to_datetime(data.get("warranty_expiry")),
            "notes": data.get("notes"),
            "created_by": created_by,
            "created_at": now,
            "updated_at": now,
        }

        try:
            return await self.repository.create(asset_data)
        except DuplicateKeyError as exc:
            raise AppException(f"Asset tag {asset_tag} already exists", 409) from exc

    # -------------------------------------------------------------------- Read

    async def get_asset(self, asset_id: str):
        asset = await self.repository.get_by_id(asset_id)

        if not asset:
            raise AppException("Asset not found", 404)

        return asset

    async def get_assets(
        self,
        status: str | None = None,
        category: str | None = None,
        search: str | None = None,
        employee_id: str | None = None,
        department_id: str | None = None,
        pagination: PaginationParams | None = None,
    ):
        filters: dict = {}

        if status:
            filters["status"] = status

        if category:
            filters["category"] = category

        if employee_id:
            filters["assigned_to_employee_id"] = employee_id

        if department_id:
            filters["department_id"] = department_id

        if search and search.strip():
            pattern = {"$regex": re.escape(search.strip()), "$options": "i"}
            filters["$or"] = [
                {"asset_tag": pattern},
                {"name": pattern},
                {"brand_model": pattern},
                {"serial_number": pattern},
                {"assigned_to_name": pattern},
                {"assigned_to_employee_id": pattern},
            ]

        total = await self.repository.count(filters)

        if not pagination:
            return await self.repository.get_all(filters, 0, 0), total

        return (
            await self.repository.get_all(
                filters,
                pagination.skip,
                pagination.limit,
            ),
            total,
        )

    async def get_recent_allocations(self, limit: int = 5):
        """The assets handed out most recently, newest first.

        Feeds the Recent Allocation panel, which answers "who was given what,
        and when" rather than "what did somebody ask for".
        """

        return await self.repository.recent_allocations(limit)

    # ------------------------------------------------------------------- Stats

    async def get_stats(self):
        """Everything the summary cards and the donut need, in one call.

        Reporting both from the same snapshot means the cards and the chart can
        never disagree with each other mid-render.
        """

        status_counts = {status: 0 for status in ASSET_STATUS_ORDER}

        for row in await self.repository.status_counts():
            if row["_id"] in status_counts:
                status_counts[row["_id"]] = row["count"]

        raw_categories = {
            row["_id"]: row["count"] for row in await self.repository.category_counts()
        }

        total_assets = sum(status_counts.values())

        # Every category is reported, even at zero, so the donut legend keeps a
        # stable set of slices instead of losing a colour when stock runs out.
        category_counts = [
            {
                "category": category,
                "count": raw_categories.get(category, 0),
                "percentage": (
                    round(raw_categories.get(category, 0) / total_assets * 100, 1)
                    if total_assets
                    else 0.0
                ),
            }
            for category in ASSET_CATEGORY_ORDER
        ]

        month_start, month_end = _month_bounds()

        return {
            "total_assets": total_assets,
            "in_use": status_counts[AssetStatus.IN_USE.value],
            "available": status_counts[AssetStatus.AVAILABLE.value],
            "pending_return": status_counts[AssetStatus.PENDING_RETURN.value],
            "maintenance": status_counts[AssetStatus.MAINTENANCE.value],
            "total_purchase_value": await self.repository.total_purchase_value(),
            "pending_requests": await self.request_repository.count_pending(),
            "allocated_this_month": await self.repository.allocated_this_month(
                month_start,
                month_end,
            ),
            "category_counts": category_counts,
        }

    # -------------------------------------------------------------- Allocation

    async def get_allocation(
        self,
        view: str = "employee",
        search: str | None = None,
        category: str | None = None,
        pagination: PaginationParams | None = None,
    ):
        """Rows for the Asset Allocation table, by employee or by department.

        Employee rows always include employees holding no assets so the table
        stays a stable list of who has a device rather than only who has one.
        """

        filters = {"category": category} if category else {}

        counts = (
            await self.repository.employee_allocation_counts(filters)
            if view == "employee"
            else await self.repository.department_allocation_counts(filters)
        )
        count_by_key = {row["_id"]: row["count"] for row in counts}

        employees, departments = await self._employee_and_department_index()

        query = (search or "").strip().lower()

        if view == "employee":
            rows = [
                {
                    "id": employee["employee_id"],
                    "name": employee.get("full_name") or employee["employee_id"],
                    "department": departments.get(str(employee.get("department_id")), {}).get(
                        "name"
                    ),
                    "employees": 0,
                    "asset_count": count_by_key.get(employee["employee_id"], 0),
                }
                for employee in employees.values()
            ]

            rows.sort(key=lambda row: (-row["asset_count"], row["name"]))
        else:
            employee_totals: dict[str, int] = {}

            for employee in employees.values():
                department_id = employee.get("department_id")

                if not department_id:
                    continue

                employee_totals[department_id] = employee_totals.get(department_id, 0) + 1

            rows = [
                {
                    "id": department_id,
                    "name": department.get("name") or department_id,
                    "department": None,
                    "employees": employee_totals.get(department_id, 0),
                    "asset_count": count_by_key.get(department_id, 0),
                }
                for department_id, department in departments.items()
            ]

            rows.sort(key=lambda row: (-row["asset_count"], row["name"]))

        if query:
            rows = [
                row
                for row in rows
                if query in row["id"].lower()
                or query in row["name"].lower()
                or (row["department"] and query in row["department"].lower())
            ]

        total = len(rows)

        if not pagination:
            return rows, total

        start = pagination.skip
        end = start + pagination.limit

        return rows[start:end], total

    # ------------------------------------------------------------------ Update

    async def update_asset(self, asset_id: str, data: dict):
        existing = await self.get_asset(asset_id)

        update_data: dict = {}

        for field in ("name", "category", "brand_model", "serial_number", "vendor", "notes"):
            if field in data:
                value = data[field]
                update_data[field] = value.strip() if isinstance(value, str) else value

        if "status" in data:
            requested = data["status"]
            requested_value = (
                requested.value if isinstance(requested, AssetStatus) else requested
            )

            # Status follows the holder: you cannot park an asset as "available"
            # while someone is still holding it, or flip an assigned asset to
            # maintenance and strand the assignment.
            if existing.get("assigned_to_employee_id"):
                if requested_value != AssetStatus.IN_USE.value:
                    raise AppException(
                        "This asset is assigned to an employee. Return it before "
                        "changing its status.",
                        409,
                    )
            else:
                update_data["status"] = requested_value

        for field in ("purchase_cost",):
            if field in data:
                update_data[field] = data[field]

        for field in ("purchase_date", "warranty_expiry"):
            if field in data:
                update_data[field] = to_datetime(data[field])

        if not update_data:
            return existing

        update_data["updated_at"] = _now()

        return await self.repository.update(asset_id, update_data)

    async def delete_asset(self, asset_id: str):
        asset = await self.get_asset(asset_id)

        if asset.get("assigned_to_employee_id"):
            raise AppException(
                "This asset is assigned to an employee. Return it before deleting it.",
                409,
            )

        return await self.repository.delete(asset_id)

    # ----------------------------------------------------------- Assign/return

    async def assign_asset(
        self,
        asset_id: str,
        employee_id: str,
        issue_date: date | None = None,
    ):
        asset = await self.get_asset(asset_id)

        current_holder = asset.get("assigned_to_employee_id")

        if current_holder:
            holder = asset.get("assigned_to_name") or current_holder
            raise AppException(
                f"This asset is already assigned to {holder}. Return it before "
                "assigning it to someone else.",
                409,
            )

        employee = await self._resolve_employee(employee_id)

        update_data = {
            **self._assignment_fields(employee),
            "status": AssetStatus.IN_USE.value,
            "issue_date": to_datetime(issue_date) or _now(),
            "returned_at": None,
            "updated_at": _now(),
        }

        return await self.repository.update(asset_id, update_data)

    async def return_asset(self, asset_id: str):
        asset = await self.get_asset(asset_id)

        if not asset.get("assigned_to_employee_id"):
            raise AppException(
                "This asset is not currently assigned to anyone",
                400,
            )

        update_data = {
            **self._assignment_fields(None),
            "status": AssetStatus.AVAILABLE.value,
            "returned_at": _now(),
            "updated_at": _now(),
        }

        return await self.repository.update(asset_id, update_data)