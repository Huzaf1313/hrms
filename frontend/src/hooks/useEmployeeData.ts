import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { queryKeys } from "../lib/queryKeys";

export interface AttendanceRecord {
  date: string;
  check_in: string | null;
  check_out: string | null;
  in_time?: string | null;
  out_time?: string | null;
  status?: string | null;
}

export interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
  reason?: string | null;
  requested_at?: string | null;
}

export interface LeaveListResponse {
  items: LeaveRequest[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface LeaveBalance {
  leave_type: string;
  available: number;
  allocated: number;
  used: number;
}

export interface Announcement {
  id?: string;
  title: string;
  description: string;
  category?: string;
  priority?: string;
  status?: string;
  published_at?: string | null;
  publish_date?: string | null;
  expiry_date?: string | null;
  audience?: string | null;
  author_name?: string | null;
  created_at?: string | null;
  pinned?: boolean;
  attachment?: {
    filename: string;
    url: string;
    content_type?: string;
    size?: number;
  } | null;
  is_important?: boolean;
}

export interface AnnouncementResponse {
  announcements: Announcement[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export function useEmployeeAttendance(
  employeeId?: string | null,
  page: number = 1,
  limit: number = 100,
) {
  return useQuery<AttendanceRecord[]>({
    queryKey: queryKeys.employee.attendance(employeeId || "", { page, limit }),
    queryFn: () =>
      api.get<AttendanceRecord[]>(
        `/employee-attendance/employees/${employeeId}`,
        { page, limit },
      ),
    enabled: Boolean(employeeId),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useEmployeeLeaves(
  employeeId?: string | null,
  page: number = 1,
  limit: number = 100,
) {
  return useQuery<LeaveListResponse>({
    queryKey: queryKeys.employee.leaves(employeeId || ""),
    queryFn: () =>
      api.get<LeaveListResponse>(`/employee-leave/employees/${employeeId}`, {
        page,
        limit,
      }),
    enabled: Boolean(employeeId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useEmployeeLeaveBalances(employeeId?: string | null) {
  return useQuery<LeaveBalance[]>({
    queryKey: queryKeys.employee.leaveBalances(employeeId || ""),
    queryFn: () =>
      api.get<LeaveBalance[]>(
        `/employee-leave/employees/${employeeId}/balance`,
      ),
    enabled: Boolean(employeeId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useEmployeeAnnouncements(
  page: number = 1,
  pageSize: number = 3,
) {
  return useQuery<AnnouncementResponse>({
    queryKey: [...queryKeys.employee.announcements(), { page, pageSize }],
    queryFn: () =>
      api.get<AnnouncementResponse>("/employee-announcements", {
        page,
        page_size: pageSize,
      }),
    // A new announcement should reach a dashboard that is already open, so
    // this feed is refreshed on a timer and whenever the tab regains focus.
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/** Organization-wide announcement feed used by the admin dashboard marquee. */
export function useAdminAnnouncements(limit: number = 100) {
  return useQuery<Announcement[]>({
    queryKey: [...queryKeys.admin.announcements(), { limit }],
    queryFn: async () => {
      try {
        const res = await api.get<Announcement[]>("/announcements", {
          limit,
        });
        if (Array.isArray(res) && res.length > 0) return res;
      } catch (err) {
        console.warn("Failed to fetch /announcements, trying fallback:", err);
      }
      try {
        const empRes = await api.get<AnnouncementResponse>("/employee-announcements", {
          page: 1,
          page_size: limit,
        });
        if (empRes?.announcements && empRes.announcements.length > 0) {
          return empRes.announcements;
        }
      } catch {
        // Fallback error ignored
      }
      return [];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export interface EmployeeLatestPayroll {
  id: string;
  employee_id: string;
  month: string;
  net_salary: number;
  salary?: Record<string, unknown>;
  payment?: {
    status?: string;
    paid_on?: string;
  };
}

export function useEmployeeLatestPayroll(employeeId?: string | null) {
  return useQuery<EmployeeLatestPayroll | null>({
    queryKey: queryKeys.employee.payrollLatest(employeeId || ""),
    queryFn: async () => {
      try {
        return await api.get<EmployeeLatestPayroll>(
          `/employee-payroll/employees/${employeeId}/latest`,
        );
      } catch {
        return null;
      }
    },
    enabled: Boolean(employeeId),
    staleTime: 5 * 60 * 1000,
  });
}
