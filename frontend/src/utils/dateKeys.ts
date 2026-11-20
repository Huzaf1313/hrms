/**
 * Calendar helpers for the shared header date.
 *
 * Kept apart from the provider component so those files export components only,
 * which is what React Fast Refresh needs to swap a module without a full reload.
 */

/** "YYYY-MM-DD" for a local Date, so it matches the backend's date strings
 *  without a timezone shifting the day. */
export function toDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** The first of the month a "YYYY-MM-DD" belongs to. */
export function monthStartOf(dateKey: string): Date {
  const parsed = new Date(`${dateKey}T00:00:00`);

  return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
}

/** True when the string is a real YYYY-MM-DD calendar date. Guards the query
 *  param, which anyone can hand-edit in the address bar. */
export function isDateKey(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00`);

  return !Number.isNaN(parsed.getTime()) && toDateKey(parsed) === value;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Returns format "20 Nov 2026" consistently across the app. */
export function formatDisplayDate(value?: Date | string | number | null): string {
  if (!value) return "--";
  let d: Date;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === "string") {
    d = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  } else {
    d = new Date(value);
  }
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Returns format "8h 12m" or "0h 0m" consistently across the app (never "0hr 0min"). */
export function formatDurationHours(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "" || val === "--") return "0h 0m";

  if (typeof val === "number") {
    if (val <= 0 || isNaN(val)) return "0h 0m";
    const hrs = Math.floor(val);
    const mins = Math.round((val - hrs) * 60);
    return `${hrs}h ${mins}m`;
  }

  const text = String(val).trim();
  const hmMatch = text.match(/^(\d+)\s*(?:h|hr|hours?)\s*(\d+)?\s*(?:m|min|minutes?)?$/i);
  if (hmMatch) {
    const hrs = parseInt(hmMatch[1] || "0", 10);
    const mins = parseInt(hmMatch[2] || "0", 10);
    return `${hrs}h ${mins}m`;
  }

  const decMatch = text.match(/^(\d+(?:\.\d+)?)\s*h?$/i);
  if (decMatch) {
    const num = parseFloat(decMatch[1]);
    if (isNaN(num) || num <= 0) return "0h 0m";
    const hrs = Math.floor(num);
    const mins = Math.round((num - hrs) * 60);
    return `${hrs}h ${mins}m`;
  }

  return text.replace(/hr/gi, "h").replace(/min/gi, "m");
}
