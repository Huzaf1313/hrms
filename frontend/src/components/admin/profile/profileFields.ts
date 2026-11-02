import type {
  AdminProfile,
  DocumentStatus,
  EmploymentStatus,
  ProfileTab,
} from "../../../types/adminProfile";

/**
 * Per-tab field descriptors and presentation helpers for the profile page.
 *
 * Kept out of the component files so those export components only, which is
 * what React Fast Refresh needs. The descriptors drive the edit form
 * generically, so adding a field is a one-line change here.
 */

export type ProfileFieldType = "text" | "email" | "tel" | "date" | "select" | "textarea";

export interface ProfileFieldSpec {
  name: keyof AdminProfile;
  label: string;
  type: ProfileFieldType;
  options?: readonly string[];
  /** System-owned: shown but not editable. */
  readOnly?: boolean;
  /** Spans both columns of the form grid. */
  full?: boolean;
  hint?: string;
}

export const PROFILE_PANEL_CLASS = "rounded-2xl border border-gray-100 bg-white shadow-sm";

export const PROFILE_INPUT_CLASS =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 " +
  "outline-none transition placeholder:text-slate-400 focus:border-blue-500 " +
  "focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50";

export const PROFILE_LABEL_CLASS = "mb-1.5 block text-xs font-semibold text-slate-600";

export const PROFILE_TEXTAREA_CLASS =
  "w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 " +
  "outline-none transition placeholder:text-slate-400 focus:border-blue-500 " +
  "focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"] as const;
const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"] as const;
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const EMPLOYMENT_TYPES = ["Full Time", "Part Time", "Contract", "Intern"] as const;
export const PROFILE_FIELDS: Record<ProfileTab, ProfileFieldSpec[]> = {
  Overview: [
    { name: "full_name", label: "Full Name", type: "text", readOnly: true, hint: "Managed by your administrator." },
    { name: "employee_id", label: "Employee ID", type: "text", readOnly: true },
    { name: "designation", label: "Designation", type: "text" },
    { name: "department", label: "Department", type: "text" },
    { name: "work_location", label: "Work Location", type: "text" },
    { name: "shift", label: "Shift", type: "select" },
    {
      name: "date_of_joining",
      label: "Date of Joining",
      type: "date",
      readOnly: true,
      hint: "Set by HR when the record was created.",
    },
  ],
  "Personal Details": [
    { name: "full_name", label: "Full Name", type: "text", readOnly: true, hint: "Managed by your administrator." },
    { name: "date_of_birth", label: "Date of Birth", type: "date" },
    { name: "gender", label: "Gender", type: "select", options: GENDERS },
    { name: "marital_status", label: "Marital Status", type: "select", options: MARITAL_STATUSES },
    { name: "nationality", label: "Nationality", type: "text" },
    { name: "blood_group", label: "Blood Group", type: "select", options: BLOOD_GROUPS },
    { name: "emergency_name", label: "Emergency Contact Name", type: "text" },
    { name: "emergency_relationship", label: "Relationship", type: "text" },
    { name: "emergency_phone", label: "Emergency Phone", type: "tel" },
    { name: "emergency_email", label: "Emergency Email", type: "email" },
  ],
  "Professional Details": [
    { name: "designation", label: "Designation", type: "text" },
    { name: "role", label: "Role", type: "text", readOnly: true, hint: "Set by your administrator." },
    { name: "department", label: "Department", type: "text" },
    { name: "department_head", label: "Department Head", type: "text", readOnly: true, hint: "Set from department records." },
    { name: "reporting_manager", label: "Reporting Manager", type: "text", readOnly: true, hint: "Set by your administrator." },
    { name: "work_location", label: "Work Location", type: "text" },
    { name: "employment_type", label: "Employment Type", type: "select", options: EMPLOYMENT_TYPES },
    { name: "shift", label: "Shift", type: "select" },
    {
      name: "date_of_joining",
      label: "Date of Joining",
      type: "date",
      readOnly: true,
      hint: "Set by HR when the record was created.",
    },
  ],
  "Contact & Address": [
    { name: "email", label: "Email", type: "email", readOnly: true, hint: "Managed by your administrator." },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "office_email", label: "Office Email", type: "email", readOnly: true, hint: "Uses your account email." },
    { name: "work_phone", label: "Work Phone", type: "tel", readOnly: true, hint: "Uses your account phone." },
    { name: "permanent_address", label: "Permanent Address", type: "textarea", full: true },
    { name: "current_address", label: "Current Address", type: "textarea", full: true },
  ],
  Documents: [],
};

export const EMPLOYMENT_STATUS_STYLES: Record<EmploymentStatus, string> = {
  Active: "bg-emerald-50 text-emerald-600",
  "On Leave": "bg-orange-50 text-orange-500",
  Inactive: "bg-gray-100 text-gray-500",
};

export const DOCUMENT_STATUS_STYLES: Record<DocumentStatus, string> = {
  Verified: "bg-emerald-50 text-emerald-600",
  Pending: "bg-orange-50 text-orange-500",
  Rejected: "bg-rose-50 text-rose-600",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** `1990-02-10` or an ISO timestamp in to `10 Feb 1990`. */
export function formatProfileDate(value: string | null | undefined): string {
  if (!value) return "—";

  const [year, month, day] = value.slice(0, 10).split("-");

  if (!year || !month || !day || !MONTHS[Number(month) - 1]) return value;

  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

/** ISO timestamp in to `12 Oct 2025, 10:24 AM`. */
export function formatProfileDateTime(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return `${date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}, ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })}`;
}

/** Whole years and leftover months between the joining date and today. */
export function experienceFrom(joiningDate: string | null | undefined): string {
  if (!joiningDate) return "—";

  const start = new Date(`${joiningDate.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(start.getTime())) return "—";

  const now = new Date();
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());

  if (now.getDate() < start.getDate()) months -= 1;

  const years = Math.floor(months / 12);

  return `${years} ${years === 1 ? "Year" : "Years"} ${months % 12} ${
    months % 12 === 1 ? "Month" : "Months"
  }`;
}
