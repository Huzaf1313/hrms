import { api } from "../../../services/api";
import {
  leaveService as adminLeaveApi,
  type LeaveRequest,
  type LeaveSummary,
  type LeaveBalance,
  type EmployeeLeaveBalance,
  type LeaveStatus,
} from "../admin_leave_service";
import type {
  MockHoliday,
  MockTeamLeave,
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
      // Request failed
    }
    return { data: [], isSampleData: false };
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
      // Request failed
    }
    return { items: [], total: 0, isSampleData: false };
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
    return [];
  },

  /** Fetch team leaves for team calendar / overlap checking */
  async getTeamLeaves(): Promise<MockTeamLeave[]> {
    return [];
  },
};

export type { LeaveRequest, LeaveSummary, LeaveBalance, EmployeeLeaveBalance, LeaveStatus };
