import re
from datetime import date

from pydantic import BaseModel, EmailStr, Field, field_validator

NAME_DIGIT_PATTERN = re.compile(r"[0-9]")
EMPLOYEE_PHONE_PATTERN = re.compile(r"^[0-9]{10}$")


def validate_employee_name(value: str | None, field_label: str) -> str | None:
    if value is None:
        return None

    value = value.strip()

    if NAME_DIGIT_PATTERN.search(value):
        raise ValueError(f"{field_label} cannot contain numbers")

    if not value:
        raise ValueError(f"{field_label} cannot be blank")

    return value


def validate_employee_phone(value: str | None) -> str | None:
    if value is None:
        return None

    value = value.strip().replace(" ", "").replace("-", "")

    if re.search(r"[A-Za-z]", value):
        raise ValueError("Phone number cannot contain letters")

    if not EMPLOYEE_PHONE_PATTERN.match(value):
        raise ValueError("Phone number must be exactly 10 digits")

    return value


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
    employee_id: str | None = None
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)

    email: EmailStr
    phone: str = Field(min_length=10)
    password: str = Field(min_length=8, max_length=128)

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
    # Account id of the reporting manager. This is what scopes a manager to
    # their own team; reporting_manager above is display only.
    manager_id: str | None = None
    salary_structure: str | None = None
    salary: str | None = None

    # Shift assignment. Drives the shift length used for overtime.
    shift_id: str | None = None


    # Additional Information
    emergency_contact: EmergencyContact | None = None
    bank_information: BankInformation | None = None

    # Email verification token
    email_verification_token: str = Field(
        default="",
        description="Verification token issued after verifying employee email OTP",
    )

    @field_validator("first_name")
    @classmethod
    def validate_first_name(cls, value: str) -> str:
        return validate_employee_name(value, "First name")

    @field_validator("last_name")
    @classmethod
    def validate_last_name(cls, value: str) -> str:
        return validate_employee_name(value, "Last name")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        return validate_employee_phone(value)


class EmployeeUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None

    email: EmailStr | None = None
    phone: str | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)

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
    # Account id of the reporting manager. This is what scopes a manager to
    # their own team; reporting_manager above is display only.
    manager_id: str | None = None
    salary_structure: str | None = None
    salary: str | None = None

    # Shift assignment. Drives the shift length used for overtime.
    shift_id: str | None = None

    emergency_contact: EmergencyContact | None = None
    bank_information: BankInformation | None = None

    @field_validator("first_name")
    @classmethod
    def validate_first_name(cls, value: str | None) -> str | None:
        return validate_employee_name(value, "First name")

    @field_validator("last_name")
    @classmethod
    def validate_last_name(cls, value: str | None) -> str | None:
        return validate_employee_name(value, "Last name")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        return validate_employee_phone(value)


class EmployeeCredentials(BaseModel):

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
    # Account id of the reporting manager. This is what scopes a manager to
    # their own team; reporting_manager above is display only.
    manager_id: str | None = None
    salary_structure: str | None = None
    salary: str | None = None

    # Shift assignment. Drives the shift length used for overtime.
    shift_id: str | None = None


    # Additional Information
    emergency_contact: EmergencyContact | None = None
    bank_information: BankInformation | None = None

    # Status
    status: str

    # Admin user id (Mongo _id as str) who created this profile. Null on records
    # that predate the field.
    created_by: str | None = None

    # Login credentials (only populated right after creation)
    credentials: EmployeeCredentials | None = None

    # Welcome email delivery outcome
    welcome_email_sent: bool | None = None


class EmployeeOTPRequest(BaseModel):
    email: EmailStr


class EmployeeOTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)

    @field_validator("otp")
    @classmethod
    def validate_otp_digits(cls, value: str) -> str:
        value = value.strip()
        if not value.isdigit() or len(value) != 6:
            raise ValueError("OTP must be exactly 6 digits")
        return value


class EmployeeOTPRequestResponse(BaseModel):
    message: str
    expires_in_minutes: int
    cooldown_seconds: int


class EmployeeOTPVerifyResponse(BaseModel):
    message: str
    email: str
    verification_token: str
    expires_in_minutes: int
