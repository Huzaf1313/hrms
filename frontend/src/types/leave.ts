export const LEAVE_TYPES = [
  "Casual Leave",
  "Sick Leave",
  "Earned Leave",
  "Comp Off",
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

/**
 * Payload the admin leave form produces. Field names mirror the create
 * endpoint so wiring the API call later is a one-liner.
 */
export interface LeaveRequestDraft {
  employee_id: string;
  employee_name?: string;
  department_id?: string;
  department_name?: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  /** Supporting document picked in the form. It never leaves the browser. */
  attachment_name?: string;
  attachment_size?: number;
}
