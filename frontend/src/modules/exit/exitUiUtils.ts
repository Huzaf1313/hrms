import { useEffect, type RefObject } from "react";

import { EXIT_STATUSES, EXIT_TYPES } from "./types";
import type { ExitStatus } from "./types";
import type { ExitRequest } from "./types";

/**
 * Presentation helpers for the exit pages.
 *
 * Kept apart from the components so those files export components only, which
 * is what React Fast Refresh needs to swap a module without a full reload.
 */

export const PANEL_CLASS = "rounded-[2px] border border-[#E5E7EB] bg-white overflow-hidden shadow-none";

export const INPUT_CLASS =
  "h-8 w-full rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[12px] text-[#111827] " +
  "outline-none transition placeholder:text-[#7B8794] focus:border-[#2F5FD0] " +
  "focus:ring-1 focus:ring-[#2F5FD0]";

export const SELECT_CLASS = `${INPUT_CLASS} appearance-none pr-7 cursor-pointer`;

/**
 * Accessible dialog keyboard handling: Escape to dismiss, Tab focus trapping
 * inside the container, and focus restoration to the opener on close.
 */
export function useDialogA11y(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement as HTMLElement | null;
    const node = containerRef.current;

    if (node) {
      const focusables = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length > 0 && !node.contains(document.activeElement)) {
        focusables[0].focus();
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Tab" && containerRef.current) {
        const focusables = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first || !containerRef.current.contains(document.activeElement)) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last || !containerRef.current.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener && typeof opener.focus === "function") {
        opener.focus();
      }
    };
  }, [open, containerRef, onClose]);
}

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