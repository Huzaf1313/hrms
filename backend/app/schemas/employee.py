from datetime import date
import re

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.user import validate_password_strength

EMPLOYEE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$")
PHONE_PATTERN = re.compile(r"^\+?[0-9]{10,15}$")


class EmergencyContact(BaseModel):
    name: str
    relationship: str
    phone: str
    alternate_phone: str | None = None
    address: str | None = None


class BankInformation(BaseModel):
    bank_name: str
    account_holder_name: str
    account_number: str
    ifsc_code: str
    branch: str | None = None


class TransferHistory(BaseModel):
    from_department: str
    to_department: str
    transfer_date: date
    reason: str | None = None


class PromotionHistory(BaseModel):
    from_designation: str
    to_designation: str
    promotion_date: date
    reason: str | None = None


class EmployeeCreate(BaseModel):
    # Employee Profile
    employee_id: str = Field(min_length=1)
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)

    email: EmailStr
    phone: str = Field(min_length=10)

    # Employee Avatar / Photo
    avatar_url: str | None = None

    date_of_birth: date | None = None
    gender: str | None = None
    address: str | None = None

    # Employment Information
    department_id: str
    designation: str
    joining_date: date

    employment_type: str = "Full-time"
    work_location: str | None = None
    reporting_manager: str | None = None

    # Additional Information
    emergency_contact: EmergencyContact | None = None
    bank_information: BankInformation | None = None

    # Login credentials (auto-generated when omitted)
    password: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("employee_id")
    @classmethod
    def validate_employee_id(cls, value: str) -> str:
        value = value.strip()

        if not EMPLOYEE_ID_PATTERN.match(value):
            raise ValueError(
                "Employee ID may only contain letters, numbers, hyphens and underscores"
            )

        return value

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name_part(cls, value: str) -> str:
        value = value.strip()

        if len(value) < 1:
            raise ValueError("Name cannot be empty")

        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        value = value.strip().replace(" ", "").replace("-", "")

        if not PHONE_PATTERN.match(value):
            raise ValueError(
                "Phone number must be 10 to 15 digits with an optional + prefix"
            )

        return value

    @field_validator("password")
    @classmethod
    def validate_login_password(cls, value: str | None) -> str | None:
        if value is None:
            return value

        return validate_password_strength(value)


class EmployeeUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None

    email: EmailStr | None = None
    phone: str | None = None

    # Employee Avatar / Photo
    avatar_url: str | None = None

    date_of_birth: date | None = None
    gender: str | None = None
    address: str | None = None

    department_id: str | None = None
    designation: str | None = None
    joining_date: date | None = None

    employment_type: str | None = None
    work_location: str | None = None
    reporting_manager: str | None = None

    emergency_contact: EmergencyContact | None = None
    bank_information: BankInformation | None = None


class EmployeeCredentials(BaseModel):
    """Login credentials for the employee account - only returned once,
    right after the employee is created, so the admin can share them."""

    email: EmailStr
    temporary_password: str


class EmployeeResponse(BaseModel):
    id: str

    # Profile
    employee_id: str
    first_name: str
    last_name: str

    email: EmailStr
    phone: str

    # Employee Avatar / Photo
    avatar_url: str | None = None

    date_of_birth: date | None = None
    gender: str | None = None
    address: str | None = None

    # Employment
    department_id: str
    designation: str
    joining_date: date

    employment_type: str
    work_location: str | None = None
    reporting_manager: str | None = None

    # Additional Information
    emergency_contact: EmergencyContact | None = None
    bank_information: BankInformation | None = None

    # Status
    status: str

    # Only populated on create
    credentials: EmployeeCredentials | None = None