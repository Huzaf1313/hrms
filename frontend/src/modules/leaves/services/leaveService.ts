import { api } from "../../../services/api";
import {
  leaveService as adminLeaveApi,
  type LeaveRequest,
  type LeaveSummary,
  type LeaveBalance,
  type EmployeeLeaveBalance,
  type LeaveStatus,
} from "../admin_leave_service";
import {
  leaveMockService,
  MOCK_DEFAULT_BALANCES,
  type MockHoliday,
  type MockTeamLeave,
} from "../../../services/mock/leaveMockService";

export interface ApplyLeavePayload {
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  is_half_day?: boolean;
  half_day_period?: "first_half" | "second_half";
}

export const leaveService = {
  ...adminLeaveApi,

  /** Fetch employee's own balance, with sample fallback if backend is offline */
  async getEmployeeBalances(employeeId: string): Promise<{ data: EmployeeLeaveBalance[]; isSampleData: boolean }> {
    try {
      const res = await api.get<EmployeeLeaveBalance[]>(
        `/employee-leave/employees/${encodeURIComponent(employeeId)}/balance`
      );
      if (Array.isArray(res) && res.length > 0) {
        return { data: res, isSampleData: false };
      }
    } catch {
      // Graceful fallback to default balances
    }
    return { data: MOCK_DEFAULT_BALANCES, isSampleData: true };
  },

  /** Fetch employee's own requests list */
  async getEmployeeRequests(employeeId: string, page = 1): Promise<{ items: LeaveRequest[]; total: number; isSampleData: boolean }> {
    try {
      const res = await api.get<{ items: LeaveRequest[]; total?: number }>(
        `/employee-leave/employees/${encodeURIComponent(employeeId)}`,
        { page, limit: 50 }
      );
      if (res && Array.isArray(res.items)) {
        return { items: res.items, total: res.total ?? res.items.length, isSampleData: false };
      }
    } catch {
      // Fallback
    }
    const sampleItems: LeaveRequest[] = [
      {
        id: "mock-lr-1",
        employee_id: employeeId,
        employee_name: "Sarah Jenkins",
        department_name: "Engineering",
        leave_type: "Casual Leave",
        start_date: "2026-11-26",
        end_date: "2026-11-27",
        total_days: 2,
        reason: "Personal family commitment and travel",
        status: "pending",
        created_at: "2026-11-18T10:00:00Z",
      },
      {
        id: "mock-lr-2",
        employee_id: employeeId,
        employee_name: "Sarah Jenkins",
        department_name: "Engineering",
        leave_type: "Sick Leave",
        start_date: "2026-11-04",
        end_date: "2026-11-04",
        total_days: 1,
        reason: "Doctor consultation and seasonal flu recovery",
        status: "approved",
        created_at: "2026-11-03T16:30:00Z",
      },
      {
        id: "mock-lr-3",
        employee_id: employeeId,
        employee_name: "Sarah Jenkins",
        department_name: "Engineering",
        leave_type: "Earned Leave",
        start_date: "2026-10-15",
        end_date: "2026-10-19",
        total_days: 3,
        reason: "Annual vacation trip",
        status: "approved",
        created_at: "2026-10-01T09:15:00Z",
      },
    ];
    return { items: sampleItems, total: sampleItems.length, isSampleData: true };
  },

  /** Apply for leave */
  async applyLeave(payload: ApplyLeavePayload): Promise<unknown> {
    return api.post("/employee-leave", payload);
  },

  /** Approve a leave request */
  async approveRequest(requestId: string): Promise<unknown> {
    return this.updateStatus(requestId, "approved");
  },

  /** Reject a leave request */
  async rejectRequest(requestId: string, comment?: string): Promise<unknown> {
    void comment;
    return this.updateStatus(requestId, "rejected");
  },

  /** Cancel a pending request */
  async cancelRequest(requestId: string): Promise<unknown> {
    return api.patch(`/employee-leave/${requestId}/cancel`);
  },

  /** Fetch company holidays */
  async getHolidays(): Promise<MockHoliday[]> {
    return leaveMockService.getHolidays();
  },

  /** Fetch team leaves for team calendar / overlap checking */
  async getTeamLeaves(): Promise<MockTeamLeave[]> {
    return leaveMockService.getTeamLeaves();
  },
};

export type { LeaveRequest, LeaveSummary, LeaveBalance, EmployeeLeaveBalance, LeaveStatus };
