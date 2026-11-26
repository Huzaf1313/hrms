import { CalendarRange, ChevronDown, Filter, RotateCcw } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { PANEL_CLASS, SELECT_CLASS } from "./exitUiUtils";
import { hasActiveFilters, type ExitFilters } from "./exitUiUtils";
import type { Department } from "../departments/types";

interface ExitQuickFiltersProps {
  filters: ExitFilters;
  departments: Department[];
  onChange: (next: ExitFilters) => void;
  onReset: () => void;
}

/**
 * The right-hand filter rail from the overview layout.
 *
 * Every change filters the list immediately, so the card only offers Reset.
 * Exit type is left to the tab strip and status to the toolbar.
 */
export default function ExitQuickFilters({
  filters,
  departments,
  onChange,
  onReset,
}: ExitQuickFiltersProps) {
  const set = <K extends keyof ExitFilters>(key: K, value: ExitFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className={`${PANEL_CLASS} rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)]`}>
      <div className="flex items-center gap-2.5 border-b border-[#E5E7EB] bg-white px-5 py-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2F5FD0]">
          <Filter className="h-3.5 w-3.5 shrink-0" />
        </span>
        <h3 className="text-[13px] font-semibold text-[#111827]">Quick Filters</h3>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <label htmlFor="qf-department" className="mb-1.5 block text-[12px] font-medium text-[#4B5563]">
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
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" />
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[12px] font-medium text-[#4B5563]">
            Date Range
          </span>

          <div className="space-y-2">
            <div className="relative">
              <CalendarRange className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" />
              <input
                type="date"
                aria-label="Submitted on or after"
                value={filters.from}
                onChange={(event) => set("from", event.target.value)}
                className={`${SELECT_CLASS} pl-8 pr-2.5`}
              />
            </div>

            <div className="relative">
              <CalendarRange className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" />
              <input
                type="date"
                aria-label="Submitted on or before"
                value={filters.to}
                onChange={(event) => set("to", event.target.value)}
                className={`${SELECT_CLASS} pl-8 pr-2.5`}
              />
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={!hasActiveFilters(filters)}
          leftIcon={<RotateCcw className="h-3.5 w-3.5 shrink-0" />}
          className="h-8 w-full text-[12px] font-medium shadow-none"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}