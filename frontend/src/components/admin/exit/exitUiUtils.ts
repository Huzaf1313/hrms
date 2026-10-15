import { EXIT_STATUSES, EXIT_TYPES } from "../../../types/exitRequest";
import type { ExitStatus } from "../../../types/exitRequest";
import type { ExitRequest } from "../../../types/exitRequest";

/**
 * Presentation helpers for the exit pages.
 *
 * Kept apart from the components so those files export components only, which
 * is what React Fast Refresh needs to swap a module without a full reload.
 */

export const PANEL_CLASS = "rounded-2xl border border-slate-200 bg-white";

export const INPUT_CLASS =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 " +
  "outline-none transition placeholder:text-slate-400 focus:border-blue-500 " +
  "focus:ring-2 focus:ring-blue-100";

export const SELECT_CLASS = `${INPUT_CLASS} appearance-none pr-8`;

/* ------------------------------------------------------------------- dates */

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return `${date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function percent(part: number, whole: number): string {
  if (!whole) return "0%";

  return `${Math.round((part / whole) * 100)}%`;
}

/* ------------------------------------------------------------------ filters */

/** The exit list's filters. Exit type is scoped by the tab strip, not here. */
export interface ExitFilters {
  status: "" | ExitStatus;
  department_id: string;
  /** Inclusive ISO date (yyyy-mm-dd) the request was submitted on or after. */
  from: string;
  to: string;
  search: string;
}

export const EMPTY_EXIT_FILTERS: ExitFilters = {
  status: "",
  department_id: "",
  from: "",
  to: "",
  search: "",
};

export function hasActiveFilters(filters: ExitFilters): boolean {
  return Boolean(
    filters.status ||
      filters.department_id ||
      filters.from ||
      filters.to ||
      filters.search,
  );
}

export { EXIT_STATUSES, EXIT_TYPES };

/* ------------------------------------------------------------------ actions */

/**
 * The request a checklist or quick action should act on: the oldest still
 * pending, falling back to one already in clearance. Returning null is how the
 * panels know to keep their actions disabled.
 */
export function pickActionable(requests: ExitRequest[]): ExitRequest | null {
  return (
    requests.find((request) => request.status === "Pending") ??
    requests.find((request) => request.status === "In Progress") ??
    null
  );
}

export type InlineNotice = { type: "success" | "error"; text: string } | null;