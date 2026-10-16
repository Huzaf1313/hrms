export const PROFILE_TABS = [
  "Overview",
  "Personal Details",
  "Professional Details",
  "Contact & Address",
  "Documents",
  "Account Settings",
] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

export type EmploymentStatus = "Active" | "On Leave" | "Inactive";

/**
 * One record covering everything the profile page shows. Identity fields the
 * system owns (employee id, joining date, employment status) are read-only in
 * the edit form; the rest is maintained by the person themselves.
 */
export interface AdminProfile {
  // Identity
  full_name: string;
  employee_id: string;
  avatar_url: string | null;

  // Employment
  designation: string;
  role: string;
  department: string;
  department_head: string;
  reporting_manager: string;
  work_location: string;
  employment_type: string;
  shift: string;
  date_of_joining: string;
  employment_status: EmploymentStatus;

  // Contact
  email: string;
  phone: string;
  office_email: string;
  work_phone: string;

  // Personal
  date_of_birth: string;
  gender: string;
  marital_status: string;
  nationality: string;
  blood_group: string;

  // Address
  permanent_address: string;
  current_address: string;

  // Emergency contact
  emergency_name: string;
  emergency_relationship: string;
  emergency_phone: string;
  emergency_email: string;
}

export interface SessionInfo {
  login_status: "Active" | "Inactive";
  last_login: string;
  device: string;
  ip_address: string;
}

export interface ProfileActivity {
  id: string;
  occurred_at: string;
  activity: string;
  module: string;
  details: string;
}

export type DocumentStatus = "Verified" | "Pending" | "Rejected";

export interface ProfileDocument {
  id: string;
  name: string;
  type: string;
  uploaded_on: string;
  status: DocumentStatus;
}

export interface SupportContact {
  phone: string;
  email: string;
}

export interface NotificationPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  leave_updates: boolean;
  payroll_alerts: boolean;
}
