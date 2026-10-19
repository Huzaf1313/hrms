import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarDays,
  ChevronDown,
  ClipboardPlus,
  Search,
  Send,
  UserRound,
  X,
} from "lucide-react";

import { employeeService } from "../../services/employeeService";
import type { Department } from "../../types/department";
import type { Employee } from "../../types/employee";
import { LEAVE_TYPES, type LeaveRequestDraft, type LeaveType } from "../../types/leave";
import { countWorkingDays, parseDateOnly } from "../../utils/workingDays";

const MAX_REASON_LENGTH = 300;

const FIELD_CLASS =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 " +
  "outline-none transition placeholder:text-slate-400 focus:border-blue-500 " +
  "focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const SELECT_CLASS = `${FIELD_CLASS} appearance-none pr-9`;

function todayAsInputValue(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${today.getFullYear()}-${month}-${day}`;
}

function formatDate(value: string): string {
  const parsed = parseDateOnly(value);

  if (!parsed) {
    return "";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function employeeName(employee: Employee): string {
  return `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim();
}

interface NewLeaveRequestModalProps {
  departments: Department[];
  onClose: () => void;
  onSubmit: (draft: LeaveRequestDraft) => void | Promise<void>;
  isSubmitting?: boolean;
}

export default function NewLeaveRequestModal({
  departments,
  onClose,
  onSubmit,
  isSubmitting = false,
}: NewLeaveRequestModalProps) {
  const today = todayAsInputValue();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [employeeSearch, setEmployeeSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>(LEAVE_TYPES[0]);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reason, setReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const busy = isSubmitting || submitting;

  useEffect(() => {
    let active = true;

    employeeService
      .listAll()
      .then((rows) => {
        if (active) setEmployees(rows);
      })
      .catch(() => {
        if (active) {
          setEmployees([]);
          setLoadError("Employees could not be loaded. You can still fill the rest of the form.");
        }
      })
      .finally(() => {
        if (active) setLoadingEmployees(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const departmentNames = useMemo(() => {
    const names = new Map<string, string>();

    for (const department of departments) {
      names.set(department.id, department.name);
    }

    return names;
  }, [departments]);

  const filteredEmployees = useMemo(() => {
    const needle = employeeSearch.trim().toLowerCase();

    return employees.filter((employee) => {
      if (departmentId && employee.department_id !== departmentId) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return (
        employeeName(employee).toLowerCase().includes(needle) ||
        employee.employee_id.toLowerCase().includes(needle)
      );
    });
  }, [departmentId, employeeSearch, employees]);

  const totalDays = useMemo(
    () => (fromDate && toDate ? countWorkingDays(fromDate, toDate) : 0),
    [fromDate, toDate],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    setError("");

    if (!employeeId) {
      setError("Please choose the employee this leave belongs to.");
      return;
    }

    if (!fromDate || !toDate) {
      setError("Please choose both the from and to dates.");
      return;
    }

    const start = parseDateOnly(fromDate);
    const end = parseDateOnly(toDate);

    if (!start || !end || end < start) {
      setError("The to date cannot be before the from date.");
      return;
    }

    if (totalDays === 0) {
      setError("The selected range falls only on Saturdays or Sundays. Pick at least one working day.");
      return;
    }

    if (!reason.trim()) {
      setError("Please enter a reason for the leave.");
      return;
    }

    if (reason.trim().length > MAX_REASON_LENGTH) {
      setError(`Reason cannot exceed ${MAX_REASON_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        employee_id: employeeId,
        leave_type: leaveType,
        start_date: fromDate,
        end_date: toDate,
        reason: reason.trim(),
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create the leave request.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <ClipboardPlus className="h-5 w-5 text-[#2563eb]" />
            </span>

            <div>
              <h2 className="text-xl font-bold text-slate-900">New Leave Request</h2>
              <p className="mt-1 text-sm text-slate-500">
                Record a leave request on behalf of an employee.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* Employee */}
            <div>
              <label htmlFor="leave-employee-search" className="mb-2 block text-sm font-semibold text-slate-700">
                Employee <span className="ml-1 text-red-500">*</span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    id="leave-employee-search"
                    type="search"
                    value={employeeSearch}
                    disabled={busy}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder="Search by name or ID"
                    className={`${FIELD_CLASS} pl-9`}
                  />
                </div>

                <div className="relative">
                  <select
                    value={departmentId}
                    disabled={busy}
                    onChange={(event) => setDepartmentId(event.target.value)}
                    className={SELECT_CLASS}
                    aria-label="Filter employees by department"
                  >
                    <option value="">All Departments</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="relative mt-3">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <select
                  id="leave-employee"
                  value={employeeId}
                  disabled={busy || loadingEmployees}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  className={`${SELECT_CLASS} pl-9`}
                >
                  <option value="">
                    {loadingEmployees
                      ? "Loading employees..."
                      : filteredEmployees.length === 0
                        ? "No employees match this filter"
                        : "Select an employee"}
                  </option>

                  {filteredEmployees.map((employee) => (
                    <option key={employee.employee_id} value={employee.employee_id}>
                      {employee.employee_id} - {employeeName(employee)}
                      {departmentNames.get(employee.department_id)
                        ? ` (${departmentNames.get(employee.department_id)})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {loadError && <p className="mt-2 text-xs text-amber-600">{loadError}</p>}
            </div>

            {/* Leave type */}
            <div>
              <label htmlFor="leave-type" className="mb-2 block text-sm font-semibold text-slate-700">
                Leave Type <span className="ml-1 text-red-500">*</span>
              </label>

              <div className="relative">
                <select
                  id="leave-type"
                  value={leaveType}
                  disabled={busy}
                  onChange={(event) => setLeaveType(event.target.value as LeaveType)}
                  className={SELECT_CLASS}
                >
                  {LEAVE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="leave-from-date" className="mb-2 block text-sm font-semibold text-slate-700">
                  From Date <span className="ml-1 text-red-500">*</span>
                </label>

                <div className="relative">
                  <input
                    id="leave-from-date"
                    type="date"
                    value={fromDate}
                    disabled={busy}
                    onChange={(event) => {
                      const nextStart = parseDateOnly(event.target.value);
                      const currentEnd = parseDateOnly(toDate);

                      setFromDate(event.target.value);

                      if (nextStart && currentEnd && currentEnd < nextStart) {
                        setToDate(event.target.value);
                      }
                    }}
                    className={`${FIELD_CLASS} pr-10`}
                  />

                  <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>

                {fromDate && <p className="mt-1.5 text-xs text-slate-400">{formatDate(fromDate)}</p>}
              </div>

              <div>
                <label htmlFor="leave-to-date" className="mb-2 block text-sm font-semibold text-slate-700">
                  To Date <span className="ml-1 text-red-500">*</span>
                </label>

                <div className="relative">
                  <input
                    id="leave-to-date"
                    type="date"
                    value={toDate}
                    min={fromDate || today}
                    disabled={busy}
                    onChange={(event) => setToDate(event.target.value)}
                    className={`${FIELD_CLASS} pr-10`}
                  />

                  <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>

                {toDate && <p className="mt-1.5 text-xs text-slate-400">{formatDate(toDate)}</p>}
              </div>
            </div>

            {/* Working days */}
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Working Days</span>

                <span className="text-base font-bold text-[#2563eb]">
                  {totalDays > 0 ? `${totalDays} ${totalDays === 1 ? "Day" : "Days"}` : "—"}
                </span>
              </div>

              <p className="mt-1.5 text-xs text-slate-500">
                {totalDays === 0
                  ? "Saturdays and Sundays are weekly offs. Pick at least one working day."
                  : "Excludes Saturdays and Sundays."}
              </p>
            </div>

            {/* Reason */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="leave-draft-reason" className="text-sm font-semibold text-slate-700">
                  Reason <span className="ml-1 text-red-500">*</span>
                </label>

                <span
                  className={`text-xs ${
                    reason.length >= MAX_REASON_LENGTH ? "text-red-500" : "text-slate-400"
                  }`}
                >
                  {reason.length}/{MAX_REASON_LENGTH}
                </span>
              </div>

              <textarea
                id="leave-draft-reason"
                value={reason}
                maxLength={MAX_REASON_LENGTH}
                rows={4}
                disabled={busy}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Enter the reason for this leave..."
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Request
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
