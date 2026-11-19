from datetime import datetime

from pydantic import BaseModel, Field

from app.core.roles import UserRole


class UserModel(BaseModel):
    id: str | None = None

    full_name: str
    email: str

    password_hash: str

    role: UserRole = UserRole.EMPLOYEE

    is_active: bool = True
    is_locked: bool = False

    failed_login_attempts: int = 0

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)