import { api } from "./api";
import type {
  OvertimeRow,
  Shift,
  ShiftAssignment,
  ShiftCreate,
  ShiftUpdate,
} from "../types/shift";

export const shiftService = {
  /** Active shifts only - the list employees are allowed to see. */
  list() {
    return api.get<Shift[]>("/shifts");
  },

  /** All shifts including inactive ones. Admin only. */
  listAll(includeInactive = true) {
    return api.get<Shift[]>("/admin/shifts", {
      include_inactive: includeInactive,
    });
  },

  myShift() {
    return api.get<Shift | null>("/shifts/me");
  },

  create(data: ShiftCreate) {
    return api.post<Shift>("/admin/shifts", data);
  },

  update(shiftId: string, data: ShiftUpdate) {
    return api.put<Shift>(`/admin/shifts/${shiftId}`, data);
  },

  remove(shiftId: string) {
    return api.delete<null>(`/admin/shifts/${shiftId}`);
  },

  assign(employeeId: string, shiftId: string | null) {
    return api.put<ShiftAssignment>(`/admin/employees/${employeeId}/shift`, {
      shift_id: shiftId,
    });
  },

  forEmployee(employeeId: string) {
    return api.get<ShiftAssignment>(
      `/admin/employees/${employeeId}/shift`,
    );
  },
};

export const overtimeService = {
  /** Hours only - overtime is not converted to money anywhere. */
  report(params: {
    start_date: string;
    end_date: string;
    department_id?: string;
    shift_id?: string;
  }) {
    return api.get<OvertimeRow[]>("/admin/overtime", {
      start_date: params.start_date,
      end_date: params.end_date,
      department_id: params.department_id || undefined,
      shift_id: params.shift_id || undefined,
    });
  },
};

/** "09:30" -> "09:30 AM", for showing a shift's start time. */
export function formatShiftTime(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;

  const suffix = hours < 12 ? "AM" : "PM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** 540 -> "9h". Shows a shift's length. */
export function formatDuration(minutes: number): string {
  if (!minutes) return "-";

  const hours = minutes / 60;

  if (Number.isInteger(hours)) return `${hours}h`;

  return `${hours.toFixed(1)}h`;
}
