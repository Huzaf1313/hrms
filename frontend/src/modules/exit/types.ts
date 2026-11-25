export type ExitStatus =
  | "Pending"
  | "In Progress"
  | "Completed"
  | "Rejected"
  | "Cancelled";

export type HandoverStatus = "Pending" | "In Progress" | "Completed";

export const EXIT_STATUSES: ExitStatus[] = [
  "Pending",
  "In Progress",
  "Completed",
  "Rejected",
  "Cancelled",
];

export const EXIT_TYPES = ["Resignation", "Termination"] as const;

export type ExitType = (typeof EXIT_TYPES)[number];

export const EXIT_TYPE_META: Record<ExitType, { label: string; color: string; dot: string }> = {
  Resignation: { label: "Resignation", color: "#2F5FD0", dot: "bg-[#2F5FD0]" },
  Termination: { label: "Termination", color: "#9B1C1C", dot: "bg-[#9B1C1C]" },
};

// Must match the backend Literals in schemas/exit_request.py.
export const NOTICE_PERIODS = [15, 30, 60, 90] as const;

export const RESIGNATION_REASONS = [
  "Better Opportunity",
  "Higher Studies",
  "Career Change",
  "Relocation",
  "Health Reasons",
  "Personal Reasons",
  "Work-Life Balance",
  "Other",
] as const;

export const HANDOVER_STATUSES: HandoverStatus[] = [
  "Pending",
  "In Progress",
  "Completed",
];

export const DEFAULT_HANDOVER_TASKS = [
  { task: "Ongoing Projects", placeholder: "e.g. Project A - handover to John" },
  { task: "Pending Approvals", placeholder: "e.g. Leave approvals, purchase requests" },
  { task: "Team Handover", placeholder: "e.g. Handover to team lead" },
  { task: "Other Tasks", placeholder: "e.g. Access, documents, etc." },
] as const;

export const ALLOWED_ATTACHMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;

export interface HandoverTask {
  task: string;
  remarks: string | null;
  status: HandoverStatus;
  is_checked: boolean;
}

export interface HandoverTasksUpdate {
  handover_tasks: HandoverTask[];
}

export interface ExitAttachment {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

export interface ExitDocument {
  key: string;
  label: string;
  required: boolean;
  status: "Pending" | "Submitted";
  file_name: string | null;
  file_size: number | null;
  uploaded_at: string | null;
}

export interface ExitRequest {
  id: string;
  request_number: string | null;
  employee_id: string;
  employee_name: string | null;
  email: string | null;
  designation: string | null;
  department_id: string | null;
  department_name: string | null;
  reporting_manager: string | null;
  exit_type: string;
  last_working_day: string;
  notice_period_days: number;
  reason: string;
  remarks: string | null;
  handover_tasks: HandoverTask[];
  attachments: ExitAttachment[];
  documents: ExitDocument[];
  status: ExitStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExitRequestList {
  items: ExitRequest[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DepartmentExitCount {
  department_id: string | null;
  department_name: string;
  count: number;
}

export interface ExitRequestSummary {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  rejected: number;
  cancelled: number;
  /** Every type, including zeroes, so the cards keep a stable set. */
  by_type: Record<ExitType, number>;
  by_department: DepartmentExitCount[];
}
