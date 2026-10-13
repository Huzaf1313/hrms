import { CalendarRange, ChevronDown, Filter, RotateCcw } from "lucide-react";

import { SELECT_CLASS } from "./exitUiUtils";
import {
  EXIT_STATUSES,
  EXIT_TYPES,
  hasActiveFilters,
  type ExitFilters,
} from "./exitUiUtils";
import type { Department } from "../../../types/department";

interface ExitQuickFiltersProps {
  filters: ExitFilters;
  departments: Department[];
  onChange: (next: ExitFilters) => void;
  onApply: () => void;
  onReset: () => void;
}

/**
 * The right-hand filter rail from the overview layout.
 *
 * Edits are staged locally and only pushed upstream on Apply, so a half-typed
 * date does not fire a request per keystroke.
 */
export default function ExitQuickFilters({
  filters,
  departments,
  onChange,
  onApply,
  onReset,
}: ExitQuickFiltersProps) {
  const set = <K extends keyof ExitFilters>(key: K, value: ExitFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <Filter className="h-4 w-4 text-blue-600" />
        <h3 className="text-[15px] font-bold text-slate-900">Quick Filters</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="qf-type" className="mb-1.5 block text-xs font-semibold text-slate-600">
            Exit Type
          </label>
          <div className="relative">
            <select
              id="qf-type"
              value={filters.exit_type}
              onChange={(event) => set("exit_type", event.target.value as ExitFilters["exit_type"])}
              className={SELECT_CLASS}
            >
              <option value="">All Types</option>
              {EXIT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div>
          <label htmlFor="qf-status" className="mb-1.5 block text-xs font-semibold text-slate-600">
            Status
          </label>
          <div className="relative">
            <select
              id="qf-status"
              value={filters.status}
              onChange={(event) => set("status", event.target.value as ExitFilters["status"])}
              className={SELECT_CLASS}
            >
              <option value="">All Status</option>
              {EXIT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div>
          <label htmlFor="qf-department" className="mb-1.5 block text-xs font-semibold text-slate-600">
            Department
          </label>
          <div className="relative">
            <select
              id="qf-department"
              value={filters.department_id}
              onChange={(event) => set("department_id", event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
            Date Range
          </span>

          <div className="space-y-2">
            <div className="relative">
              <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                aria-label="Submitted on or after"
                value={filters.from}
                onChange={(event) => set("from", event.target.value)}
                className={`${SELECT_CLASS} pl-9`}
              />
            </div>

            <div className="relative">
              <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                aria-label="Submitted on or before"
                value={filters.to}
                onChange={(event) => set("to", event.target.value)}
                className={`${SELECT_CLASS} pl-9`}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onReset}
            disabled={!hasActiveFilters(filters)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>

          <button
            type="button"
            onClick={onApply}
            className="h-9 flex-1 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}