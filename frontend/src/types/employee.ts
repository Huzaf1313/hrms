export type EmployeeStatus =
  | "active"
  | "inactive"
  | "on_leave"
  | "terminated";

export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "intern";

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  alternate_phone?: string;
  address?: string;
}

export interface BankInformation {
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  branch?: string;
}

export interface TransferHistory {
  from_department: string;
  to_department: string;
  transfer_date: string;
  reason?: string;
}

export interface PromotionHistory {
  from_designation: string;
  to_designation: string;
  promotion_date: string;
  reason?: string;
}

export interface EmployeeCredentials {
  email: string;
  temporary_password: string;
}

export interface Employee {
  id: string;

  // Profile
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password?: string;
  avatar_url?: string;
  credentials?: EmployeeCredentials;

  date_of_birth?: string;
  gender?: string;
  address?: string;

  // Employment
  department_id: string;
  designation: string;
  joining_date: string;
  employment_type: EmploymentType;
  work_location?: string;
  reporting_manager?: string;
  /** Account id of the reporting manager - this is what scopes a
   *  manager to their own team. */
  manager_id?: string | null;
  salary_structure?: string;
  salary?: string;
  shift_id?: string;

  // Additional Information
  emergency_contact?: EmergencyContact;
  bank_information?: BankInformation;

  // History
  transfer_history?: TransferHistory[];
  promotion_history?: PromotionHistory[];

  // Status
  status: EmployeeStatus;
}

export interface EmployeeCreate {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password?: string;

  date_of_birth?: string;
  gender?: string;
  address?: string;

  department_id: string;
  designation: string;
  joining_date: string;
  employment_type: EmploymentType;
  work_location?: string;
  reporting_manager?: string;
  /** Account id of the reporting manager - this is what scopes a
   *  manager to their own team. */
  manager_id?: string | null;
  salary_structure?: string;
  salary?: string;
  shift_id?: string;

  emergency_contact?: EmergencyContact;
  bank_information?: BankInformation;
  email_verification_token?: string;
}

export interface EmployeeOTPRequestResponse {
  message: string;
  expires_in_minutes: number;
  cooldown_seconds: number;
}

export interface EmployeeOTPVerifyResponse {
  message: string;
  email: string;
  verification_token: string;
  expires_in_minutes: number;
}

export interface EmployeeUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;

  date_of_birth?: string;
  gender?: string;
  address?: string;

  department_id?: string;
  designation?: string;
  joining_date?: string;
  employment_type?: EmploymentType;
  work_location?: string;
  reporting_manager?: string;
  /** Account id of the reporting manager - this is what scopes a
   *  manager to their own team. */
  manager_id?: string | null;
  salary_structure?: string;
  salary?: string;
  shift_id?: string;

  emergency_contact?: EmergencyContact;
  bank_information?: BankInformation;
}