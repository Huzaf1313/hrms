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
  shift_id?: string | null;
  shift: string;
  shift_start?: string | null;
  shift_end?: string | null;
  shift_duration_minutes?: number | null;
  in_time?: string | null;
  out_time?: string | null;
  working_hours?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  total_hours?: number | string | null;
  /** Numeric source of truth. working_hours above is display-only text. */
  worked_minutes?: number | null;
  overtime_minutes?: number;
  overtime_display?: string | null;
  late_minutes?: number;
  late_display?: string | null;
  is_overtime?: boolean;
  is_late?: boolean;
  is_overnight?: boolean;
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

export interface AttendanceOptions {
  work_locations: string[];
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
  overtime_employee_count?: number;
  overtime_total_minutes?: number;
  overtime_total_display?: string | null;
  department_presence: AttendanceDepartmentPresence[];
}
