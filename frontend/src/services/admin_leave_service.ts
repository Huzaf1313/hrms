import { api } from "./api";

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  // Working days only, computed by the backend. Saturdays and Sundays are
  // predefined weekly offs and are never counted.
  total_days?: number | null;
  reason?: string | null;
  /** Supporting document name, for requests created from the admin portal. */
  attachment_name?: string | null;
  /** Size of that document in bytes. */
  attachment_size?: number | null;
  status: LeaveStatus;
  created_at: string;
}

export interface LeaveListResponse {
  items: LeaveRequest[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface LeaveSummary {
  total_leave_requests: number;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  on_leave_today: number;
  upcoming_leaves: number;
}

export const leaveService = {
  list(params: {
    page?: number;
    limit?: number;
    status?: LeaveStatus;
    leave_type?: string;
    department_id?: string;
    /** "YYYY-MM-DD". Only returns leaves covering that day. */
    date?: string;
  } = {}) {
    return api.get<LeaveListResponse>("/admin/leaves", params);
  },

  summary() {
    return api.get<LeaveSummary>("/admin/leaves/summary");
  },

  updateStatus(id: string, status: Exclude<LeaveStatus, "pending" | "cancelled">) {
    return api.patch<LeaveRequest>(`/admin/leaves/${id}/status`, { status });
  },
};
