export type ExitStatus =
  | "Pending"
  | "In Progress"
  | "Completed"
  | "Rejected"
  | "Cancelled";

export type HandoverStatus = "Pending" | "In Progress" | "Completed";

/**
 * The four ways an employee can leave. Only Resignation is raised by the
 * employee; the rest are recorded by HR from the admin side.
 */
export type ExitType = "Resignation" | "Termination" | "Contract End" | "Retirement";

/** Matches EXIT_TYPE_ORDER on the backend. */
export const EXIT_TYPES: ExitType[] = [
  "Resignation",
  "Termination",
  "Contract End",
  "Retirement",
];

export const EXIT_TYPE_META: Record<
  ExitType,
  { label: string; color: string; dot: string }
> = {
  Resignation: { label: "Resignation", color: "#2563eb", dot: "bg-blue-500" },
  Termination: { label: "Termination", color: "#ef4444", dot: "bg-rose-500" },
  "Contract End": { label: "Contract End", color: "#a855f7", dot: "bg-purple-500" },
  Retirement: { label: "Retirement", color: "#8b5cf6", dot: "bg-violet-500" },
};

export const EXIT_STATUSES: ExitStatus[] = [
  "Pending",
  "In Progress",
  "Completed",
  "Rejected",
  "Cancelled",
];

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
 
export interface ExitAttachment {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}
 
export interface ExitRequest {
  id: string;
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
  /** Always all four types, including zeroes, so the cards keep a stable set. */
  by_type: Record<ExitType, number>;
  by_department: DepartmentExitCount[];
}