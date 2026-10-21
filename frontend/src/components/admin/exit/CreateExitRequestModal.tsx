import { useEffect, useMemo, useState } from "react";
import { ChevronDown, LogOut, X } from "lucide-react";

import { SELECT_CLASS, INPUT_CLASS } from "./exitUiUtils";
import { adminExitRequestService } from "../../../services/exitRequestService";
import { employeeService } from "../../../services/employeeService";
import { ApiError } from "../../../services/api";
import { EXIT_TYPES } from "../../../types/exitRequest";
import type { ExitType } from "../../../types/exitRequest";
import type { Employee } from "../../../types/employee";

const LABEL_CLASS = "mb-1.5 block text-xs font-semibold text-slate-600";

/** Default checklist offered when HR records a departure. */
const DEFAULT_HANDOVER = [
  "Registration-Formal",
  "Access Deactivation",
  "Asset Return",
  "Document Collection",
  "Final Settlement",
];

interface CreateExitRequestModalProps {
  /** Locks the type, e.g. when opened from "Initiate Termination". */
  lockedType?: ExitType;
  onClose: () => void;
  onCreated: (message: string) => void;
}

export default function CreateExitRequestModal({
  lockedType,
  onClose,
  onCreated,
}: CreateExitRequestModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const [employeeId, setEmployeeId] = useState("");
  const [exitType, setExitType] = useState<ExitType>(lockedType ?? "Termination");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [tasks, setTasks] = useState<string[]>(DEFAULT_HANDOVER);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    employeeService
      .listAll()
      .then((rows) => {
        if (active) setEmployees(rows);
      })
      .catch(() => {
        if (active) setEmployees([]);
      })
      .finally(() => {
        if (active) setLoadingEmployees(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Employees carrying an open request are not eligible; the API rejects them
  // too, but hiding them here saves a pointless round trip.
  const options = useMemo(() => employees, [employees]);

  const toggleTask = (task: string) =>
    setTasks((current) =>
      current.includes(task)
        ? current.filter((entry) => entry !== task)
        : [...current, task],
    );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) return;

    setError("");

    if (!employeeId) {
      setError("Please choose the employee.");
      return;
    }

    if (!lastWorkingDay) {
      setError("Please choose the last working day.");
      return;
    }

    if (!reason.trim()) {
      setError("Please enter a reason.");
      return;
    }

    setSubmitting(true);

    try {
      await adminExitRequestService.create({
        employee_id: employeeId,
        exit_type: exitType,
        last_working_day: lastWorkingDay,
        reason: reason.trim(),
        remarks: remarks.trim() || undefined,
        handover_tasks: tasks.map((task) => ({ task, status: "Pending" as const })),
      });

      onCreated(`${exitType} recorded successfully.`);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to record the exit request.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
              <LogOut className="h-5 w-5 text-rose-600" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {lockedType ? `Initiate ${lockedType}` : "Create Exit Request"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Record a departure raised by HR rather than the employee.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="exit-employee" className={LABEL_CLASS}>
                  Employee <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="exit-employee"
                    value={employeeId}
                    disabled={submitting || loadingEmployees}
                    onChange={(event) => setEmployeeId(event.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="">
                      {loadingEmployees
                        ? "Loading employees..."
                        : options.length === 0
                          ? "No employees available"
                          : "Select an employee"}
                    </option>
                    {options.map((employee) => (
                      <option key={employee.employee_id} value={employee.employee_id}>
                        {employee.employee_id} -{" "}
                        {`${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div>
                <label htmlFor="exit-type" className={LABEL_CLASS}>
                  Exit Type <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="exit-type"
                    value={exitType}
                    disabled={submitting || Boolean(lockedType)}
                    onChange={(event) => setExitType(event.target.value as ExitType)}
                    className={SELECT_CLASS}
                  >
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
                <label htmlFor="exit-lwd" className={LABEL_CLASS}>
                  Last Working Day <span className="text-rose-500">*</span>
                </label>
                <input
                  id="exit-lwd"
                  type="date"
                  value={lastWorkingDay}
                  disabled={submitting}
                  onChange={(event) => setLastWorkingDay(event.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label htmlFor="exit-reason" className={LABEL_CLASS}>
                  Reason <span className="text-rose-500">*</span>
                </label>
                <input
                  id="exit-reason"
                  type="text"
                  maxLength={200}
                  value={reason}
                  disabled={submitting}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="e.g. Company restructuring"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div>
              <label htmlFor="exit-remarks" className={LABEL_CLASS}>
                Remarks
              </label>
              <textarea
                id="exit-remarks"
                rows={2}
                maxLength={500}
                value={remarks}
                disabled={submitting}
                onChange={(event) => setRemarks(event.target.value)}
                className="w-full resize-none rounded-lg border border-slate-200 p-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <p className={LABEL_CLASS}>Clearance Checklist</p>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_HANDOVER.map((task) => {
                  const checked = tasks.includes(task);

                  return (
                    <button
                      key={task}
                      type="button"
                      disabled={submitting}
                      onClick={() => toggleTask(task)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        checked
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {task}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Selected steps are attached as the request&apos;s handover tasks.
              </p>
            </div>

            {error && (
              <p className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {error}
              </p>
            )}
          </div>

          <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/60 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-10 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Saving...
                </>
              ) : (
                "Create Request"
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}