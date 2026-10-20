export type HolidayType = "public" | "restricted" | "optional";

export interface Holiday {
  id: string;
  name: string;
  /** Always "YYYY-MM-DD", the same format attendance records use. */
  date: string;
  type: HolidayType;
  description?: string | null;
  is_active: boolean;
}

export interface HolidayCreate {
  name: string;
  date: string;
  type?: HolidayType;
  description?: string | null;
  is_active?: boolean;
}

export type HolidayUpdate = Partial<HolidayCreate>;

export const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  public: "Public Holiday",
  restricted: "Restricted Holiday",
  optional: "Optional Holiday",
};

/**
 * Every holiday uses one colour. Keeping the calendar cell, the header-calendar
 * dot and the attendance legend on a single constant is what stops them from
 * disagreeing. Teal is unused by every other attendance state, so a holiday is
 * never mistaken for present, late, absent, leave or weekly off.
 */
export const HOLIDAY_STYLE = "bg-teal-100 text-teal-700";

/** Saturated version of HOLIDAY_STYLE, for dots and legend swatches. */
export const HOLIDAY_DOT_STYLE = "bg-teal-500";

/** "2026-10-20" -> "Tue, 20 Oct 2026". */
export function formatHolidayDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}