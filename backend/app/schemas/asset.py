from datetime import date, datetime
from enum import Enum
from typing import Generic, TypeVar

from pydantic import BaseModel, Field, field_validator

T = TypeVar("T")


class AssetCategory(str, Enum):
    """Fixed set of categories.

    The wire value is the human label the UI already shows, so the category
    filter, the donut legend and the table all speak the same string.
    """

    LAPTOP = "Laptop"
    MOBILE = "Mobile"
    MONITOR = "Monitor"
    ACCESSORIES = "Accessories"
    FURNITURE = "Furniture"
    ELECTRONICS = "Electronics"
    SOFTWARE = "Software"
    OTHERS = "Others"


class AssetStatus(str, Enum):
    IN_USE = "in_use"
    AVAILABLE = "available"
    PENDING_RETURN = "pending_return"
    MAINTENANCE = "maintenance"


class AssetRequestType(str, Enum):
    ISSUE = "issue"
    RETURN = "return"


class AssetRequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# Donut slice order and "All Status" filter order. The first entry is also the
# default the category counts fall back to, so every status always appears in
# the summary even when no asset currently holds it.
ASSET_STATUS_ORDER = [
    AssetStatus.IN_USE.value,
    AssetStatus.AVAILABLE.value,
    AssetStatus.PENDING_RETURN.value,
    AssetStatus.MAINTENANCE.value,
]

# Categories are listed in the same order as AssetCategory so the donut legend
# never reorders between requests.
ASSET_CATEGORY_ORDER = [category.value for category in AssetCategory]


class Paginated(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    limit: int


def _clean_optional_text(value: str | None) -> str | None:
    """Trim free-text fields and collapse blanks to None so "" never round-trips."""

    if value is None:
        return None

    cleaned = value.strip()

    return cleaned or None


class AssetCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: AssetCategory
    brand_model: str | None = Field(default=None, max_length=120)
    serial_number: str | None = Field(default=None, max_length=120)
    status: AssetStatus = AssetStatus.AVAILABLE
    assigned_to_employee_id: str | None = Field(default=None, max_length=32)
    issue_date: date | None = None
    purchase_date: date | None = None
    purchase_cost: float | None = Field(default=None, ge=0, le=10_000_000)
    vendor: str | None = Field(default=None, max_length=120)
    warranty_expiry: date | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("brand_model", "serial_number", "vendor", "notes")
    @classmethod
    def clean_text(cls, value):
        return _clean_optional_text(value)


class AssetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    category: AssetCategory | None = None
    brand_model: str | None = Field(default=None, max_length=120)
    serial_number: str | None = Field(default=None, max_length=120)
    status: AssetStatus | None = None
    purchase_date: date | None = None
    purchase_cost: float | None = Field(default=None, ge=0, le=10_000_000)
    vendor: str | None = Field(default=None, max_length=120)
    warranty_expiry: date | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("brand_model", "serial_number", "vendor", "notes")
    @classmethod
    def clean_text(cls, value):
        return _clean_optional_text(value)


class AssetAssign(BaseModel):
    employee_id: str = Field(min_length=2, max_length=32)
    issue_date: date | None = None


class AssetResponse(BaseModel):
    id: str
    asset_tag: str
    name: str
    category: AssetCategory
    brand_model: str | None = None
    serial_number: str | None = None
    status: AssetStatus
    assigned_to_employee_id: str | None = None
    assigned_to_name: str | None = None
    department_id: str | None = None
    department_name: str | None = None
    issue_date: date | None = None
    returned_at: date | None = None
    purchase_date: date | None = None
    purchase_cost: float | None = None
    vendor: str | None = None
    warranty_expiry: date | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------- Allocation


class AllocationRow(BaseModel):
    """One row of the allocation table.

    The employee tab fills `department`, the department tab fills `employees`.
    Both tabs share `asset_count` so a single endpoint can serve either view.
    """

    id: str
    name: str
    department: str | None = None
    employees: int = 0
    asset_count: int


# -------------------------------------------------------------------- Stats


class CategoryCount(BaseModel):
    category: AssetCategory
    count: int
    percentage: float


class AssetStats(BaseModel):
    """Figures behind the KPI cards, plus the donut's category breakdown.

    Served as one call so the summary row and the chart can never disagree
    with each other, and so the page does not fan out into two requests.
    """

    total_assets: int
    in_use: int
    available: int
    pending_return: int
    maintenance: int
    total_purchase_value: float
    pending_requests: int
    allocated_this_month: int
    category_counts: list[CategoryCount]


# ----------------------------------------------------------------- Requests


class AssetRequestCreate(BaseModel):
    request_type: AssetRequestType
    asset_id: str
    employee_id: str = Field(min_length=2, max_length=32)
    detail: str | None = Field(default=None, max_length=200)
    reason: str | None = Field(default=None, max_length=1000)


class AssetRequestReview(BaseModel):
    status: AssetRequestStatus
    admin_note: str | None = Field(default=None, max_length=1000)

    @field_validator("admin_note")
    @classmethod
    def clean_note(cls, value):
        return _clean_optional_text(value)

    @field_validator("status")
    @classmethod
    def reject_pending(cls, value):
        # "pending" is the state a request starts in, not a decision an admin
        # can hand back to it, so it is not offered as a review outcome.
        if value == AssetRequestStatus.PENDING:
            raise ValueError("A review must either approve or reject the request")

        return value


class AssetRequestResponse(BaseModel):
    id: str
    request_tag: str
    request_type: AssetRequestType
    asset_id: str | None = None
    asset_tag: str | None = None
    asset_name: str
    employee_id: str
    employee_name: str
    detail: str | None = None
    reason: str | None = None
    status: AssetRequestStatus
    # Current state of the referenced asset. Resolved when the request is
    # listed so the UI only offers "Mark Returned" where it will actually work.
    asset_status: AssetStatus | None = None
    requested_at: datetime
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None
    admin_note: str | None = None
    created_at: datetime
    updated_at: datetime