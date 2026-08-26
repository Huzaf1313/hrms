import { api } from "./api";
import type {
  AttendanceListResponse,
  AttendanceSummary,
} from "../types/attendance";

export interface GetAttendanceParams {
  date?: string;
  department_id?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const attendanceService = {
  list(params: GetAttendanceParams = {}) {
    return api.get<AttendanceListResponse>("/admin/attendance", { ...params });
  },

  summary(date: string, departmentId?: string) {
    return api.get<AttendanceSummary>("/admin/attendance/summary", {
      date,
      department_id: departmentId,
    });
  },
};