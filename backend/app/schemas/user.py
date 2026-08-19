from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.core.roles import UserRole


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)

    email: EmailStr

    phone_number: str = Field(min_length=10, max_length=15)

    password: str = Field(min_length=8, max_length=128)

    company_name: str = Field(min_length=2, max_length=150)

    company_address: str = Field(min_length=5, max_length=300)

    reference: str = Field(min_length=2, max_length=100)

    role: UserRole

class UserResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    role: UserRole
    is_active: bool
    is_locked: bool
    created_at: datetime
    updated_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshTokenRequest(BaseModel):
    refresh_token: str