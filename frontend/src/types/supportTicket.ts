export type SupportTicketCategory =
  | "IT"
  | "HR"
  | "Payroll"
  | "Attendance"
  | "Leave"
  | "Other";

export type SupportTicketPriority = "Low" | "Medium" | "High" | "Urgent";

export type SupportTicketStatus =
  | "Open"
  | "In Progress"
  | "Waiting for Employee"
  | "Resolved"
  | "Closed";

export interface SupportTicket {
  id: string;
  subject: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  description: string;
  status: SupportTicketStatus;
  employee_id: string;
  created_at: string;
  updated_at: string;
  resolution_note: string | null;
  handled_by: string | null;
  handled_at: string | null;
}

export interface SupportTicketsPage {
  tickets: SupportTicket[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** Everything the admin KPI row, breakdowns and aging panel render from.
 *  Computed in Mongo in one aggregation, so it stays correct as the ticket
 *  table grows rather than depending on how many rows the client loaded. */
export interface SupportTicketAnalytics {
  total: number;
  counts_by_status: Partial<Record<SupportTicketStatus, number>>;
  counts_by_category: Partial<Record<SupportTicketCategory, number>>;
  counts_by_priority: Partial<Record<SupportTicketPriority, number>>;
  open_by_category: Partial<Record<SupportTicketCategory, number>>;
  open_by_priority: Partial<Record<SupportTicketPriority, number>>;

  /** Open + In Progress + Waiting for Employee. */
  unhandled_count: number;
  resolved_count: number;

  /** 0..1. Resolved and closed as a share of all tickets. */
  resolution_rate: number;

  /** Null until at least one ticket has actually been handled. */
  avg_resolution_hours: number | null;
  resolved_sample_size: number;

  avg_open_age_days: number | null;
  oldest_open_age_days: number | null;

  /** Unhandled tickets older than stale_after_days. */
  stale_open_count: number;
  stale_after_days: number;

  /** Unhandled tickets still at High or Urgent priority. */
  urgent_open_count: number;
}

export interface SupportTicketSummary {
  counts_by_status: Partial<Record<SupportTicketStatus, number>>;
  total: number;
}

export const TICKET_CATEGORIES: SupportTicketCategory[] = [
  "IT",
  "HR",
  "Payroll",
  "Attendance",
  "Leave",
  "Other",
];

export const TICKET_PRIORITIES: SupportTicketPriority[] = [
  "Low",
  "Medium",
  "High",
  "Urgent",
];

export const TICKET_STATUSES: SupportTicketStatus[] = [
  "Open",
  "In Progress",
  "Waiting for Employee",
  "Resolved",
  "Closed",
];

export const TICKET_STATUS_STYLES: Record<SupportTicketStatus, string> = {
  Open: "bg-red-100 text-red-700",
  "In Progress": "bg-blue-100 text-blue-700",
  "Waiting for Employee": "bg-amber-100 text-amber-700",
  Resolved: "bg-emerald-100 text-emerald-700",
  Closed: "bg-gray-200 text-gray-600",
};

export const TICKET_PRIORITY_STYLES: Record<SupportTicketPriority, string> = {
  Low: "bg-gray-100 text-gray-600",
  Medium: "bg-blue-100 text-blue-700",
  High: "bg-amber-100 text-amber-700",
  Urgent: "bg-red-100 text-red-700",
};