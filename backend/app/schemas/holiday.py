from datetime import date

from pydantic import BaseModel, Field, field_validator

from app.models.holiday import HolidayType


def normalise_text(value: str) -> str:
    """Trim and collapse inner whitespace, so "  Diwali  " and "Diwali" are
    treated as the same holiday by the duplicate check."""
    return " ".join(str(value).split())


def parse_iso_date(value: str) -> str:
    """Normalise to "YYYY-MM-DD".

    Native date parsing rejects impossible days such as 2026-02-31, which a
    plain regex check would happily let through.
    """
    try:
        return date.fromisoformat(str(value).strip()[:10]).isoformat()
    except ValueError:
        raise ValueError("Date must be a valid calendar date (YYYY-MM-DD)")


def clean_description(value: str | None) -> str | None:
    if value is None:
        return None

    return normalise_text(value) or None


class HolidayCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    date: str = Field(description="Holiday date as YYYY-MM-DD")
    type: HolidayType = HolidayType.PUBLIC
    description: str | None = Field(default=None, max_length=500)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def check_name(cls, value: str) -> str:
        cleaned = normalise_text(value)

        if not cleaned:
            raise ValueError("Holiday name is required")

        return cleaned

    @field_validator("date")
    @classmethod
    def check_date(cls, value: str) -> str:
        return parse_iso_date(value)

    @field_validator("description")
    @classmethod
    def check_description(cls, value: str | None) -> str | None:
        return clean_description(value)


class HolidayUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    date: str | None = Field(
        default=None,
        description="Holiday date as YYYY-MM-DD",
    )
    type: HolidayType | None = None
    description: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def check_name(cls, value: str | None) -> str | None:
        if value is None:
            return None

        cleaned = normalise_text(value)

        if not cleaned:
            raise ValueError("Holiday name is required")

        return cleaned

    @field_validator("date")
    @classmethod
    def check_date(cls, value: str | None) -> str | None:
        if value is None:
            return None

        return parse_iso_date(value)

    @field_validator("description")
    @classmethod
    def check_description(cls, value: str | None) -> str | None:
        return clean_description(value)


class HolidayResponse(BaseModel):
    id: str
    name: str

    # Always "YYYY-MM-DD". Matches the date format attendance records already
    # use, so the two can be compared as plain strings.
    date: str

    type: HolidayType
    description: str | None = None
    is_active: bool = True