import re
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.roles import UserRole

NAME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z .'-]{1,99}$")
PHONE_PATTERN = re.compile(r"^\+?[0-9]{10,15}$")


def validate_password_strength(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters long")

    if not re.search(r"[A-Z]", value):
        raise ValueError("Password must contain at least one uppercase letter")

    if not re.search(r"[a-z]", value):
        raise ValueError("Password must contain at least one lowercase letter")

    if not re.search(r"[0-9]", value):
        raise ValueError("Password must contain at least one number")

    if not re.search(r"[^A-Za-z0-9]", value):
        raise ValueError(
            "Password must contain at least one special character"
        )

    return value


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)

    email: EmailStr

    phone_number: str = Field(min_length=10, max_length=15)

    password: str = Field(min_length=8, max_length=128)

    company_name: str = Field(default="", max_length=150)

    company_address: str = Field(default="", max_length=300)

    reference: str = Field(default="", max_length=100)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = value.strip()

        if not NAME_PATTERN.match(value):
            raise ValueError(
                "Full name must contain only letters, spaces, dots, apostrophes or hyphens"
            )

        return value

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str) -> str:
        value = value.strip().replace(" ", "").replace("-", "")

        if not PHONE_PATTERN.match(value):
            raise ValueError(
                "Phone number must be 10 to 15 digits with an optional + prefix"
            )

        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)


class ManagerCreate(UserCreate):
    """Manager account request. The role is fixed server-side so a client
    cannot ask for anything else."""


class UserResponse(BaseModel):
    id: str
    employee_id: str | None = None
    full_name: str
    email: EmailStr
    role: UserRole
    is_active: bool
    is_locked: bool
    created_at: datetime
    updated_at: datetime

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=1)

class VerifyPasswordResetOTPRequest(BaseModel):
    email: EmailStr
    otp: str = Field(
        min_length=6,
        max_length=6,
    )

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_token: str = Field(
        min_length=1,
    )
    new_password: str = Field(
        min_length=8,
        max_length=128,
    )
    confirm_password: str = Field(
        min_length=8,
        max_length=128,
    )

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_strength(value)

    @field_validator("confirm_password")
    @classmethod
    def validate_confirm_password(cls, value: str) -> str:
        return value


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(
        min_length=1,
        max_length=128,
    )
    new_password: str = Field(
        min_length=8,
        max_length=128,
    )
    confirm_password: str = Field(
        min_length=8,
        max_length=128,
    )

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_strength(value)

    @field_validator("confirm_password")
    @classmethod
    def validate_confirm_password(cls, value: str) -> str:
        return value


class AdminProfileResponse(BaseModel):
    """Everything the admin My Profile page renders, served from the user
    document plus name lookups. Fields the account has never had stay null so
    the frontend can render blanks instead of fake data."""

    id: str

    # Identity (system-owned, read-only in the UI)
    employee_id: str | None = None
    full_name: str
    role: str
    avatar_url: str | None = None

    # Employment
    designation: str | None = None
    department: str | None = None
    department_head: str | None = None
    reporting_manager: str | None = None
    work_location: str | None = None
    employment_type: str | None = None
    shift: str | None = None
    date_of_joining: date | None = None
    employment_status: str | None = None

    # Contact
    email: EmailStr
    phone: str | None = None
    office_email: str | None = None
    work_phone: str | None = None

    # Personal
    date_of_birth: date | None = None
    gender: str | None = None
    marital_status: str | None = None
    nationality: str | None = None
    blood_group: str | None = None

    # Address
    permanent_address: str | None = None
    current_address: str | None = None

    # Emergency contact
    emergency_name: str | None = None
    emergency_relationship: str | None = None
    emergency_phone: str | None = None
    emergency_email: str | None = None

    updated_at: datetime | None = None


class AdminProfileUpdate(BaseModel):
    """Self-service profile edits. Identity fields (full_name, email, role,
    employee_id, joining date, employment status) are deliberately absent -
    those are system-owned and change through their own flows. Dates and
    emails stay plain strings so a cleared field ("") round-trips instead of
    failing validation; the service parses what it accepts."""

    phone: str | None = Field(default=None, max_length=20)
    date_of_birth: str | None = None
    gender: str | None = Field(default=None, max_length=20)
    marital_status: str | None = Field(default=None, max_length=20)
    nationality: str | None = Field(default=None, max_length=40)
    blood_group: str | None = Field(default=None, max_length=5)
    permanent_address: str | None = Field(default=None, max_length=300)
    current_address: str | None = Field(default=None, max_length=300)
    emergency_name: str | None = Field(default=None, max_length=80)
    emergency_relationship: str | None = Field(default=None, max_length=40)
    emergency_phone: str | None = Field(default=None, max_length=20)
    emergency_email: str | None = Field(default=None, max_length=120)
    designation: str | None = Field(default=None, max_length=80)
    department: str | None = Field(default=None, max_length=80)
    shift: str | None = Field(default=None, max_length=80)
    work_location: str | None = Field(default=None, max_length=80)
    employment_type: str | None = Field(default=None, max_length=40)
