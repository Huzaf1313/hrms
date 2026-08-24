export type AttendanceStatus =
  | "present"
  | "late"
  | "absent"
  | "on_leave"
  | "working"
  | "overtime"
  | "missing_punch";

export interface AttendanceEmployee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  department_id: string;
  department_name?: string | null;
}

export interface AttendanceRecord {
  id: string;
  employee: AttendanceEmployee;
  date: string;
  shift: string;
  shift_start?: string | null;
  shift_end?: string | null;
  in_time?: string | null;
  out_time?: string | null;
  working_hours?: string | null;
  status: AttendanceStatus;
  is_regularized: boolean;
  notes?: string | null;
}

export interface AttendanceListResponse {
  items: AttendanceRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface AttendanceDepartmentPresence {
  department_id: string;
  department_name: string;
  total_employees: number;
  present_count: number;
  present_percentage: number;
}

export interface AttendanceSummary {
  date: string;
  total_employees: number;
  present_count: number;
  present_percentage: number;
  late_count: number;
  late_percentage: number;
  on_leave_count: number;
  on_leave_percentage: number;
  absent_count: number;
  absent_percentage: number;
  missing_punch_count: number;
  department_presence: AttendanceDepartmentPresence[];
}
