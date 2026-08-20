from datetime import date

from pydantic import BaseModel, EmailStr, Field


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