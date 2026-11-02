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