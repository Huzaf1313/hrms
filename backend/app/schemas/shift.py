from pydantic import BaseModel, Field, field_validator


# Shift times are stored as 24-hour "HH:MM" strings (what <input type="time">
# produces). Duration is always derived, never stored as an input, so a shift
# can never hold an end time that contradicts its start time.


def _validate_clock_time(value: str | None) -> str | None:
    """Normalise to "HH:MM" and reject impossible clock values."""
    if value is None:
        return None

    text = str(value).strip()

    if not text:
        return None

    parts = text.split(":")

    if len(parts) not in (2, 3):
        raise ValueError("Time must be in HH:MM format")

    try:
        hours = int(parts[0])
        minutes = int(parts[1])
    except ValueError:
        raise ValueError("Time must be in HH:MM format")

    if len(parts) == 3:
        # Accept a seconds component and drop it.
        try:
            int(parts[2])
        except ValueError:
            raise ValueError("Time must be in HH:MM format")

    if not 0 <= hours <= 23 or not 0 <= minutes <= 59:
        raise ValueError("Time must be a valid clock time between 00:00 and 23:59")

    return f"{hours:02d}:{minutes:02d}"


class ShiftCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    start_time: str
    end_time: str
    is_active: bool = True
    notes: str | None = None

    @field_validator("start_time", "end_time")
    @classmethod
    def check_clock_time(cls, value: str) -> str:
        normalised = _validate_clock_time(value)

        if normalised is None:
            raise ValueError("Time is required")

        return normalised


class ShiftUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    start_time: str | None = None
    end_time: str | None = None
    is_active: bool | None = None
    notes: str | None = None

    @field_validator("start_time", "end_time")
    @classmethod
    def check_clock_time(cls, value: str | None) -> str | None:
        if value is None:
            return None

        return _validate_clock_time(value)


class ShiftAssign(BaseModel):
    """Assigns (or clears, with null) a shift to one employee."""

    shift_id: str | None = None


class ShiftResponse(BaseModel):
    id: str
    name: str
    start_time: str
    end_time: str

    # Minutes between start_time and end_time, already accounting for shifts
    # that cross midnight (18:30 -> 03:30 == 540).
    duration_minutes: int

    # True when the shift ends on the following day, e.g. a night shift.
    is_overnight: bool

    is_active: bool = True
    notes: str | None = None
    assigned_employee_count: int = 0


class ShiftAssignmentResponse(BaseModel):
    employee_id: str
    shift_id: str | None = None
    shift: ShiftResponse | None = None
