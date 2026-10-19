import type {
  AdminProfile,
  NotificationPreferences,
  ProfileActivity,
  ProfileDocument,
  SessionInfo,
  SupportContact,
} from "../types/adminProfile";

/**
 * Frontend-only data source for the admin profile page.
 *
 * Everything here is served from `localStorage` so the page is fully usable
 * before the profile endpoints exist. Each method already returns a promise
 * and already has the right shape, so swapping a body for `api.get` / `api.patch`
 * is the only change needed once the backend lands. TODO: replace the storage
 * reads with GET /users/me, GET /admin/profile/session, GET /admin/profile/activities,
 * GET /admin/profile/documents and PATCH /admin/profile.
 */

const PROFILE_KEY = "hrms_admin_profile";
const NOTIFICATIONS_KEY = "hrms_admin_profile_notifications";

/** Placeholder record shaped like the design, used until one is saved. */
const SEED_PROFILE: AdminProfile = {
  full_name: "Priya Sharma",
  employee_id: "HR001",
  avatar_url: null,

  designation: "HR Manager",
  role: "HR Admin",
  department: "Human Resources",
  department_head: "Amit Verma (CEO)",
  reporting_manager: "CEO",
  work_location: "Bengaluru",
  employment_type: "Full Time",
  shift: "General Shift (9 AM - 6 PM)",
  date_of_joining: "2023-01-15",
  employment_status: "Active",

  email: "priya.sharma@trimarkity.com",
  phone: "+91 98765 43210",
  office_email: "priya.sharma@trimarkity.com",
  work_phone: "+91 98765 43210",

  date_of_birth: "1990-02-10",
  gender: "Female",
  marital_status: "Married",
  nationality: "Indian",
  blood_group: "B+",

  permanent_address: "#123, 2nd Floor, MG Road, Bengaluru, Karnataka - 560001",
  current_address: "#123, 2nd Floor, MG Road, Bengaluru, Karnataka - 560001",

  emergency_name: "Rohit Sharma",
  emergency_relationship: "Husband",
  emergency_phone: "+91 98765 43210",
  emergency_email: "rohit.sharma@email.com",
};

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

/**
 * The signed-in admin's own identity, as cached at login. Whatever it knows
 * wins over the seed so the page greets the real user.
 */
function readSessionUser(): { full_name?: string; email?: string; role?: string } | null {
  return readJson<{ full_name?: string; email?: string; role?: string }>("user");
}

function baseProfile(): AdminProfile {
  const user = readSessionUser();

  return {
    ...SEED_PROFILE,
    full_name: user?.full_name || SEED_PROFILE.full_name,
    email: user?.email || SEED_PROFILE.email,
    role: user?.role || SEED_PROFILE.role,
  };
}

export const adminProfileService = {
  async getProfile(): Promise<AdminProfile> {
    return readJson<AdminProfile>(PROFILE_KEY) ?? baseProfile();
  },

  async saveProfile(profile: AdminProfile): Promise<AdminProfile> {
    writeJson(PROFILE_KEY, profile);

    return profile;
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
