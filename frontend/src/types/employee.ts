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

export interface Employee {
  id: string;

  // Profile
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;

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

  date_of_birth?: string;
  gender?: string;
  address?: string;

  department_id: string;
  designation: string;
  joining_date: string;
  employment_type: EmploymentType;
  work_location?: string;
  reporting_manager?: string;

  emergency_contact?: EmergencyContact;
  bank_information?: BankInformation;
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

  emergency_contact?: EmergencyContact;
  bank_information?: BankInformation;
}