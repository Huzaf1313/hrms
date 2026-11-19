from datetime import datetime, date
from enum import Enum

from pydantic import BaseModel, Field


class HolidayType(str, Enum):
    # Everyone observes it.
    PUBLIC = "public"

    # Company-wide special celebration or non-working day.
    COMPANY = "company"

    # Observed by one branch/team only, shown differently on the calendar.
    RESTRICTED = "restricted"

    # Optional observance, e.g. a religious festival some staff take off.
    OPTIONAL = "optional"


class HolidayModel(BaseModel):
    """A non-working day that applies across the organization or to a specific department.

    Dates are stored as "YYYY-MM-DD" strings rather than native dates so they
    compare and sort correctly as plain text, and so they line up with the date
    format the rest of the attendance data already uses.
    """

    id: str | None = None
    name: str
    date: date
    type: HolidayType = HolidayType.PUBLIC
    description: str | None = None
    department_id: str | None = None
    department_name: str | None = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)