import { api } from "../../services/api";

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name?: string | null;
  /** Applicant's role, so HR and manager requests stand out. */
  employee_role?: string | null;
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

export interface LeaveBalance {
  leave_type: string;
  used: number;
  total: number;
  max_consecutive_days?: number;
  carry_forward_days?: number;
}

export interface EmployeeLeaveBalance {
  leave_type: string;
  allocated: number;
  used: number;
  available: number;
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

  balances() {
    return api.get<LeaveBalance[]>("/admin/leaves/balances");
  },

  employeeBalance(employeeId: string) {
    return api.get<EmployeeLeaveBalance[]>(
      `/admin/leaves/employee/${employeeId}/balance`,
    );
  },

  createType(name: string, allocated_days: number, max_consecutive_days = 3, carry_forward_days = 0) {
    return api.post<{ name: string; allocated_days: number; active: boolean }>(
      "/admin/leaves/types",
      { name, allocated_days, max_consecutive_days, carry_forward_days },
    );
  },

  updateType(oldName: string, name: string, allocated_days: number, max_consecutive_days = 3, carry_forward_days = 0) {
    return api.put<{ name: string; allocated_days: number; active: boolean }>(
      `/admin/leaves/types/${encodeURIComponent(oldName)}`,
      { name, allocated_days, max_consecutive_days, carry_forward_days },
    );
  },

  deleteType(name: string) {
    return api.delete(`/admin/leaves/types/${encodeURIComponent(name)}`);
  },

  updateBalances(balances: LeaveBalance[]) {
    return api.put<LeaveBalance[]>("/admin/leaves/balances", { balances });
  },

  updateStatus(id: string, status: Exclude<LeaveStatus, "pending" | "cancelled">) {
    return api.patch<LeaveRequest>(`/admin/leaves/${id}/status`, { status });
  },

  /**
   * File a leave request for the signed-in HR or manager account. It goes
   * through the employee endpoint, so it is stored like any other request
   * and shows up for the approvers above them (HR, the super admin).
   */
  applyForSelf(payload: {
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string;
  }) {
    return api.post<unknown>("/employee-leave", payload);
  },

  /** The signed-in account's own requests, newest first. */
  async listMine(employeeId: string, employeeName?: string): Promise<LeaveRequest[]> {
    const response = await api.get<{
      items: Array<Omit<LeaveRequest, "created_at"> & {
        created_at?: string;
        requested_at?: string;
      }>;
    }>(`/employee-leave/employees/${encodeURIComponent(employeeId)}`, { limit: 100 });

    // The employee endpoint returns its own shape: no employee name, statuses
    // stored capitalised ("Pending"), and requested_at as the filing time.
    // Normalise it to the admin LeaveRequest so both lists share one table.
    return response.items.map((item) => ({
      ...item,
      employee_name: item.employee_name ?? employeeName ?? null,
      status: String(item.status).toLowerCase() as LeaveStatus,
      created_at: item.created_at ?? item.requested_at ?? "",
    }));
  },
};
