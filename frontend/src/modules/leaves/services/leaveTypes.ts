import { parseDateOnly, isWeekendDate } from "../../../utils/workingDays";
import { MOCK_HOLIDAYS_2026 } from "../../../services/mock/leaveMockService";

export interface LeaveTypeMeta {
  key: string;
  name: string;
  accent: string;       // HEX color
  accentBg: string;     // Soft bg tint
  badgeVariant: "lt-casual" | "lt-sick" | "lt-earned" | "lt-comp" | "lt-unpaid";
  description: string;
}

export const LEAVE_TYPE_CONFIG: Record<string, LeaveTypeMeta> = {
  "Casual Leave": {
    key: "casual",
    name: "Casual Leave",
    accent: "#2F5FD0",
    accentBg: "#E8EEFB",
    badgeVariant: "lt-casual",
    description: "Personal and planned short-term absences",
  },
  "Sick Leave": {
    key: "sick",
    name: "Sick Leave",
    accent: "#C2410C",
    accentBg: "#FFEDD5",
    badgeVariant: "lt-sick",
    description: "Medical appointments and health recovery",
  },
  "Earned Leave": {
    key: "earned",
    name: "Earned Leave",
    accent: "#1E6B45",
    accentBg: "#E3F3EA",
    badgeVariant: "lt-earned",
    description: "Accrued privilege and annual vacation days",
  },
  "Comp Off": {
    key: "comp",
    name: "Comp Off",
    accent: "#6D4AB5",
    accentBg: "#F3E8FF",
    badgeVariant: "lt-comp",
    description: "Compensatory time for weekend or holiday shifts",
  },
  "Unpaid Leave": {
    key: "unpaid",
    name: "Unpaid Leave",
    accent: "#7B8794",
    accentBg: "#F0F1EE",
    badgeVariant: "lt-unpaid",
    description: "Leave without pay beyond allocated limits",
  },
};

export function getLeaveTypeMeta(name: string): LeaveTypeMeta {
  return (
    LEAVE_TYPE_CONFIG[name] || {
      key: "other",
      name,
      accent: "#7B8794",
      accentBg: "#F0F1EE",
      badgeVariant: "lt-unpaid",
      description: "Company leave policy",
    }
  );
}

/**
 * Calculates working days excluding Saturdays, Sundays, and company holidays.
 */
export function calculateWorkingDaysWithHolidays(
  startDate: string,
  endDate: string,
  isHalfDay = false,
  holidayDates = MOCK_HOLIDAYS_2026.map((h) => h.date)
): { days: number; excludedWeekends: number; excludedHolidays: number } {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end || end < start) {
    return { days: 0, excludedWeekends: 0, excludedHolidays: 0 };
  }

  let workingDays = 0;
  let excludedWeekends = 0;
  let excludedHolidays = 0;

  const current = new Date(start);
  const holidaySet = new Set(holidayDates);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    if (isWeekendDate(current)) {
      excludedWeekends++;
    } else if (holidaySet.has(dateStr)) {
      excludedHolidays++;
    } else {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  const finalDays = isHalfDay && workingDays > 0 ? workingDays - 0.5 : workingDays;

  return {
    days: Math.max(0, finalDays),
    excludedWeekends,
    excludedHolidays,
  };
}

/** Check if two date ranges overlap */
export function checkDateOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  return start1 <= end2 && end1 >= start2;
}
