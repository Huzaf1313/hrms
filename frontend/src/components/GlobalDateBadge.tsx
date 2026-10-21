import { CalendarDays, RotateCcw } from "lucide-react";

import { useGlobalDate } from "../context/globalDateContext";

/**
 * The read-only badge pages show in place of their own date control, so it is
 * obvious where the filter is coming from and how to drop it. Renders nothing
 * at all when the header date is still today, since there is nothing to undo.
 */
export function GlobalDateBadge({
  /** Extra context, e.g. "Showing leaves covering this day". */
  prefix,
}: {
  prefix?: string;
}) {
  const { date, isDefault, resetDate } = useGlobalDate();

  if (isDefault) return null;

  const label = new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex h-10 items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700">
      <CalendarDays className="h-4 w-4 shrink-0 text-blue-500" />

      <span className="truncate">
        {prefix ? `${prefix} ` : ""}
        {label}
      </span>

      <button
        type="button"
        onClick={resetDate}
        title="Clear the date filter"
        className="ml-1 flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
      >
        <RotateCcw className="h-3 w-3" />
        Clear
      </button>
    </div>
  );
}