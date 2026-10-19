import { api } from "./api";
import type {
  AttendanceListResponse,
  AttendanceOptions,
  AttendanceSummary,
  AttendanceRecord,
  EmployeeAttendanceRecord,
} from "../types/attendance";

export interface GetAttendanceParams {
  date?: string;
  department_id?: string;
  status?: string;
  search?: string;
  shift_id?: string;
  work_location?: string;
  overtime?: boolean;
  page?: number;
  limit?: number;
}

export const attendanceService = {
  list(params: GetAttendanceParams = {}) {
    return api.get<AttendanceListResponse>("/attendance", { ...params });
  },

  /** Values for the filter dropdowns (work locations, etc). */
  listOptions() {
    return api.get<AttendanceOptions>("/attendance/options");
  },

  summary(date: string, departmentId?: string) {
    return api.get<AttendanceSummary>("/attendance/summary", {
      date,
      department_id: departmentId,
    });
  },

  mark(params: {
    employee_id: string;
    date: string;
    status: string;
    /** Omit to use the employee's own assigned shift. */
    shift_id?: string | null;
    in_time?: string;
    out_time?: string;
    notes?: string;
  }) {
    return api.post<AttendanceRecord>("/attendance", params);
  },
};

/** The employee-facing attendance endpoints, kept separate from the admin
 *  ones above because they live under a different router and return a different
 *  record shape. */
export const employeeAttendance = {
  /** Most recent punches for an employee. Drives the history list. */
  recent(employeeId: string, page = 1, limit = 100) {
    return api.get<EmployeeAttendanceRecord[]>(
      `/employee-attendance/employees/${employeeId}`,
      { page, limit },
    );
  },

  /** One inclusive month of punches. Drives the calendar and its stats, so it
   *  stays small enough to refetch every time the month changes. */
  month(employeeId: string, startDate: string, endDate: string) {
    return api.get<EmployeeAttendanceRecord[]>(
      `/employee-attendance/employees/${employeeId}`,
      { start_date: startDate, end_date: endDate, limit: 100 },
    );
  },
};