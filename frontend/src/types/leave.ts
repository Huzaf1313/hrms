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
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
}
