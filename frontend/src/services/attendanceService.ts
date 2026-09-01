import { api } from "./api";
import type {
  AttendanceListResponse,
  AttendanceSummary,
  AttendanceRecord,
} from "../types/attendance";

export interface GetAttendanceParams {
  date?: string;
  department_id?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface MarkAttendanceParams {
  employee_id: string;
  date: string;
  status: string;
  shift?: string;
  in_time?: string;
  out_time?: string;
}

export const attendanceService = {
  list(params: GetAttendanceParams = {}) {
    return api.get<AttendanceListResponse>("/attendance", { ...params });
  },

  summary(date: string, departmentId?: string) {
    return api.get<AttendanceSummary>("/attendance/summary", {
      date,
      department_id: departmentId,
    });
  },

  mark(params: MarkAttendanceParams) {
    return api.post<AttendanceRecord>("/attendance", {
      ...params,
    });
  },
};