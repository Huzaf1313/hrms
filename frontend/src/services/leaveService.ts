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
  reason?: string | null;
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
  } = {}) {
    return api.get<LeaveListResponse>("/leaves", params);
  },

  summary() {
    return api.get<LeaveSummary>("/leaves/summary");
  },

  updateStatus(id: string, status: Exclude<LeaveStatus, "pending" | "cancelled">) {
    return api.patch<LeaveRequest>(`/leaves/${id}/status`, { status });
  },
};
