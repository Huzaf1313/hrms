import { api } from "./api";

import type {
  AdminProfile,
  EmploymentStatus,
  NotificationPreferences,
  ProfileActivity,
  ProfileDocument,
  SessionInfo,
  SupportContact,
} from "../types/adminProfile";

/**
 * Data source for the admin profile page.
 *
 * Profile read/write hits the backend (`GET`/`PATCH /users/me/profile`). The
 * remaining panels (session info, activities, documents, notification
 * preferences, support contact) are still served from placeholder seeds
 * until their endpoints exist - each one swaps for an api call without
 * touching the page. TODO: replace those storage reads/seeds with
 * GET /admin/profile/session, GET /admin/profile/activities,
 * GET /admin/profile/documents and a notification-preferences endpoint.
 */

const NOTIFICATIONS_KEY = "hrms_admin_profile_notifications";

/** Raw backend record: anything the account never had comes back null. */
interface BackendProfile {
  id?: string;
  employee_id?: string | null;
  full_name?: string;
  role?: string | null;
  avatar_url?: string | null;

  designation?: string | null;
  department?: string | null;
  department_head?: string | null;
  reporting_manager?: string | null;
  work_location?: string | null;
  employment_type?: string | null;
  shift?: string | null;
  date_of_joining?: string | null;
  employment_status?: string | null;

  email?: string;
  phone?: string | null;
  office_email?: string | null;
  work_phone?: string | null;

  date_of_birth?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  nationality?: string | null;
  blood_group?: string | null;

  permanent_address?: string | null;
  current_address?: string | null;

  emergency_name?: string | null;
  emergency_relationship?: string | null;
  emergency_phone?: string | null;
  emergency_email?: string | null;
}

const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  "Active",
  "On Leave",
  "Inactive",
];

/** Map the sparse backend record onto the page's filled-string shape. */
function normalizeProfile(raw: BackendProfile): AdminProfile {
  const status = (raw.employment_status ?? "") as EmploymentStatus;

  return {
    full_name: raw.full_name ?? "",
    employee_id: raw.employee_id ?? "",
    avatar_url: raw.avatar_url ?? null,

    designation: raw.designation ?? "",
    role: raw.role ?? "",
    department: raw.department ?? "",
    department_head: raw.department_head ?? "",
    reporting_manager: raw.reporting_manager ?? "",
    work_location: raw.work_location ?? "",
    employment_type: raw.employment_type ?? "",
    shift: raw.shift ?? "",
    date_of_joining: raw.date_of_joining ?? "",
    employment_status: EMPLOYMENT_STATUSES.includes(status)
      ? status
      : "Active",

    email: raw.email ?? "",
    phone: raw.phone ?? "",
    office_email: raw.office_email || raw.email || "",
    work_phone: raw.work_phone || raw.phone || "",

    date_of_birth: raw.date_of_birth ?? "",
    gender: raw.gender ?? "",
    marital_status: raw.marital_status ?? "",
    nationality: raw.nationality ?? "",
    blood_group: raw.blood_group ?? "",

    permanent_address: raw.permanent_address ?? "",
    current_address: raw.current_address ?? "",

    emergency_name: raw.emergency_name ?? "",
    emergency_relationship: raw.emergency_relationship ?? "",
    emergency_phone: raw.emergency_phone ?? "",
    emergency_email: raw.emergency_email ?? "",
  };
}

const SEED_SESSION: SessionInfo = {
  login_status: "Active",
  last_login: "2025-10-12T10:24:00",
  device: "Windows (Chrome)",
  ip_address: "103.87.65.21",
};

const SEED_ACTIVITIES: ProfileActivity[] = [
  {
    id: "act-1",
    occurred_at: "2025-10-12T10:24:00",
    activity: "Login",
    module: "System",
    details: "Logged in from Windows (Chrome)",
  },
  {
    id: "act-2",
    occurred_at: "2025-10-11T18:42:00",
    activity: "Profile Updated",
    module: "Profile",
    details: "Contact details updated",
  },
  {
    id: "act-3",
    occurred_at: "2025-10-09T09:15:00",
    activity: "Leave Approved",
    module: "Leave",
    details: "Approved a request for 2 employees",
  },
  {
    id: "act-4",
    occurred_at: "2025-10-07T16:03:00",
    activity: "Login",
    module: "System",
    details: "Logged in from Windows (Edge)",
  },
];

const SEED_DOCUMENTS: ProfileDocument[] = [
  { id: "doc-1", name: "Appointment Letter.pdf", type: "Appointment", uploaded_on: "2023-01-18", status: "Verified" },
  { id: "doc-2", name: "Passport Size Photo.jpg", type: "Identity", uploaded_on: "2023-01-18", status: "Verified" },
  { id: "doc-3", name: "PAN Card.pdf", type: "Identity", uploaded_on: "2023-01-20", status: "Verified" },
  { id: "doc-4", name: "Experience Letter.pdf", type: "Employment", uploaded_on: "2023-01-25", status: "Pending" },
  { id: "doc-5", name: "Degree Certificate.pdf", type: "Education", uploaded_on: "2023-01-25", status: "Verified" },
];

const SEED_NOTIFICATIONS: NotificationPreferences = {
  email_notifications: true,
  push_notifications: true,
  leave_updates: true,
  payroll_alerts: false,
};

const SUPPORT_CONTACT: SupportContact = {
  phone: "+91 98765 43210",
  email: "hr@trimarkity.com",
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);

    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const adminProfileService = {
  async getProfile(): Promise<AdminProfile> {
    return normalizeProfile(await api.get<BackendProfile>("/users/me/profile"));
  },

  async saveProfile(profile: AdminProfile): Promise<AdminProfile> {
    return normalizeProfile(
      await api.patch<BackendProfile>("/users/me/profile", profile),
    );
  },

  async getSession(): Promise<SessionInfo> {
    return readJson<SessionInfo>("hrms_admin_profile_session") ?? SEED_SESSION;
  },

  async listActivities(limit = 4): Promise<ProfileActivity[]> {
    const rows = readJson<ProfileActivity[]>("hrms_admin_profile_activities") ?? SEED_ACTIVITIES;

    return rows.slice(0, limit);
  },

  async listDocuments(): Promise<ProfileDocument[]> {
    return readJson<ProfileDocument[]>("hrms_admin_profile_documents") ?? SEED_DOCUMENTS;
  },

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    return readJson<NotificationPreferences>(NOTIFICATIONS_KEY) ?? SEED_NOTIFICATIONS;
  },

  async saveNotificationPreferences(preferences: NotificationPreferences): Promise<NotificationPreferences> {
    writeJson(NOTIFICATIONS_KEY, preferences);

    return preferences;
  },

  getSupportContact(): SupportContact {
    return SUPPORT_CONTACT;
  },
};
