import re
from datetime import datetime

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

    role: UserRole

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

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str = Field(
        min_length=6,
        max_length=6,
    )

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
