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
 * Profile read/write hits the backend (`GET`/`PATCH /users/me/profile`).
 * Documents use the shared employee document storage.
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

const DEFAULT_SESSION: SessionInfo = {
  login_status: "Active",
  last_login: new Date().toISOString(),
  device: typeof navigator !== "undefined" && navigator.userAgent.includes("Windows")
    ? "Windows"
    : typeof navigator !== "undefined" && navigator.userAgent.includes("Mac")
      ? "macOS"
      : "Desktop",
  ip_address: "-",
};

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
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

  async saveProfileAvatar(file: File): Promise<AdminProfile> {
    const form = new FormData();
    form.append("file", file);

    return normalizeProfile(
      await api.postForm<BackendProfile>("/users/me/profile/avatar", form),
    );
  },

  async removeProfileAvatar(): Promise<AdminProfile> {
    return normalizeProfile(
      await api.delete<BackendProfile>("/users/me/profile/avatar"),
    );
  },

  async getSession(): Promise<SessionInfo> {
    return readJson<SessionInfo>("hrms_admin_profile_session") ?? DEFAULT_SESSION;
  },

  async listActivities(limit = 4): Promise<ProfileActivity[]> {
    const rows = readJson<ProfileActivity[]>("hrms_admin_profile_activities") ?? [];

    return rows.slice(0, limit);
  },

  async listDocuments(): Promise<ProfileDocument[]> {
    const response = await api.get<{
      documents: Array<{
        id: string;
        document_name: string;
        document_type: string;
        file_name: string;
        created_at: string;
      }>;
    }>("/employee-documents");

    return response.documents.map((document) => ({
      id: document.id,
      name: document.file_name || document.document_name,
      type: document.document_type,
      uploaded_on: document.created_at,
      status: "Verified",
    }));
  },

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    return readJson<NotificationPreferences>(NOTIFICATIONS_KEY) ?? DEFAULT_NOTIFICATIONS;
  },

  async saveNotificationPreferences(preferences: NotificationPreferences): Promise<NotificationPreferences> {
    writeJson(NOTIFICATIONS_KEY, preferences);

    return preferences;
  },

  getSupportContact(): SupportContact {
    return SUPPORT_CONTACT;
  },
};
