export interface Shift {
  id: string;
  name: string;
  /** 24-hour "HH:MM", matching what <input type="time"> produces. */
  start_time: string;
  end_time: string;
  /** Minutes between start and end, already wrapping past midnight. */
  duration_minutes: number;
  /** True when the shift ends on the following day, e.g. a night shift. */
  is_overnight: boolean;
  /** Allowable check-in delay in minutes before marked late (default 15). */
  grace_period_minutes?: number;
  is_active: boolean;
  notes?: string | null;
  assigned_employee_count: number;
}

export interface ShiftCreate {
  name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes?: number;
  is_active?: boolean;
  notes?: string | null;
}

export type ShiftUpdate = Partial<ShiftCreate>;

export interface ShiftAssignment {
  employee_id: string;
  shift_id: string | null;
  shift: Shift | null;
}

export interface OvertimeRow {
  employee_id: string;
  first_name: string;
  last_name: string;
  department_id: string | null;
  shift_names: string[];
  days_with_overtime: number;
  overtime_minutes: number;
  overtime_display: string | null;
}
