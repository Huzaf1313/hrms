import { useEffect, useMemo, useState } from "react";
import { ChevronDown, LogOut, Plus, X } from "lucide-react";

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

/** Mirrors the backend's `handover_tasks` cap so the form cannot build a
 *  request the API will reject. */
const MAX_HANDOVER_TASKS = 10;

/** Mirrors the backend's per-task `max_length`. */
const MAX_TASK_LENGTH = 100;

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

  /** Steps HR typed in, kept apart from the preset ones so the defaults can
   *  never be edited away and only the custom ones are removable. */
  const [customTasks, setCustomTasks] = useState<string[]>([]);
  const [customTaskDraft, setCustomTaskDraft] = useState("");
  const [customTaskError, setCustomTaskError] = useState("");
  const [showCustomTaskInput, setShowCustomTaskInput] = useState(false);

  /** Set once the form validates, so the confirmation step can review before
   *  anything is sent. */
  const [isConfirming, setIsConfirming] = useState(false);

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

  // Preset first, then whatever HR added, so the defaults keep their order.
  const availableTasks = useMemo(
    () => [...DEFAULT_HANDOVER, ...customTasks],
    [customTasks],
  );

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.employee_id === employeeId),
    [employeeId, employees],
  );

  // Falls back to the raw id so the confirmation never reads as blank while the
  // employee list is still loading.
  const employeeLabel = selectedEmployee
    ? `${selectedEmployee.employee_id} - ${`${selectedEmployee.first_name ?? ""} ${selectedEmployee.last_name ?? ""}`.trim()}`
    : employeeId;

  function addCustomTask() {
    const next = customTaskDraft.trim();

    setCustomTaskError("");

    if (!next) return;

    if (next.length > MAX_TASK_LENGTH) {
      setCustomTaskError(
        `Keep the step under ${MAX_TASK_LENGTH} characters.`,
      );
      return;
    }

    // Compared case-insensitively, since the list is free text and "Asset
    // Return" twice would look like a bug.
    if (availableTasks.some((task) => task.toLowerCase() === next.toLowerCase())) {
      setCustomTaskError("That step is already on the list.");
      return;
    }

    if (availableTasks.length >= MAX_HANDOVER_TASKS) {
      setCustomTaskError(
        `A request can carry at most ${MAX_HANDOVER_TASKS} clearance steps.`,
      );
      return;
    }

    setCustomTasks((current) => [...current, next]);
    // Selected straight away, since the point of adding it is to run it.
    setTasks((current) => [...current, next]);
    setCustomTaskDraft("");
    setShowCustomTaskInput(false);
  }

  function removeCustomTask(task: string) {
    setCustomTasks((current) => current.filter((entry) => entry !== task));
    setTasks((current) => current.filter((entry) => entry !== task));
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
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

    if (tasks.length === 0) {
      setError("Please select at least one clearance step.");
      return;
    }

    // Nothing is sent yet: the confirmation step decides.
    setIsConfirming(true);
  };

  const confirmCreate = async () => {
    if (submitting) return;

    setSubmitting(true);
    setError("");

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
      setIsConfirming(false);
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

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {DEFAULT_HANDOVER.map((task) => {
                  const checked = tasks.includes(task);

                  return (
                    <span
                      key={task}
                      className={`inline-flex items-center rounded-full border text-xs font-medium transition ${
                        checked
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={submitting || isConfirming}
                        onClick={() => toggleTask(task)}
                        className="px-3 py-1 text-left disabled:cursor-not-allowed"
                      >
                        {task}
                      </button>
                    </span>
                  );
                })}
                {customTasks.map((task) => {
                  const checked = tasks.includes(task);

                  return (
                    <span
                      key={task}
                      className={`inline-flex items-center rounded-full border text-xs font-medium transition ${
                        checked
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={submitting || isConfirming}
                        onClick={() => toggleTask(task)}
                        className="px-3 py-1 text-left disabled:cursor-not-allowed"
                      >
                        {task}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCustomTask(task)}
                        disabled={submitting || isConfirming}
                        aria-label={`Remove ${task}`}
                        title={`Remove ${task}`}
                        className="pr-2.5 pl-0.5 opacity-60 transition hover:opacity-100 disabled:cursor-not-allowed"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setCustomTaskError("");
                    setShowCustomTaskInput(true);
                  }}
                  disabled={submitting || isConfirming || availableTasks.length >= MAX_HANDOVER_TASKS}
                  aria-label="Add a custom clearance step"
                  title="Add a custom clearance step"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-blue-300 text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {showCustomTaskInput && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={customTaskDraft}
                    disabled={submitting || isConfirming}
                    maxLength={MAX_TASK_LENGTH}
                    onChange={(event) => setCustomTaskDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomTask();
                      }
                    }}
                    placeholder="Enter a clearance step"
                    aria-label="Custom clearance step"
                    className={`${INPUT_CLASS} flex-1`}
                  />

                  <button
                    type="button"
                    onClick={addCustomTask}
                    disabled={submitting || isConfirming || !customTaskDraft.trim()}
                    className="inline-flex h-9 shrink-0 items-center rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomTaskDraft("");
                      setCustomTaskError("");
                      setShowCustomTaskInput(false);
                    }}
                    disabled={submitting || isConfirming}
                    aria-label="Cancel adding clearance step"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {customTaskError && (
                <p className="mt-1.5 text-[11px] font-medium text-rose-600">
                  {customTaskError}
                </p>
              )}

              <p className="mt-2 text-[11px] text-slate-400">
                Selected steps ({tasks.length} of {availableTasks.length}) are
                attached as the request&apos;s handover tasks.
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

      {/* Sits above the form rather than inside it, so the details being
          confirmed stay visible behind it. */}
      {isConfirming && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setIsConfirming(false);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm exit request"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start gap-3 border-b border-slate-200 px-6 py-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                <LogOut className="h-5 w-5 text-amber-600" />
              </span>

              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Create this exit request?
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  This starts clearance for the employee below.
                </p>
              </div>
            </header>

            <div className="space-y-2.5 px-6 py-5 text-sm">
              <ConfirmRow label="Employee" value={employeeLabel} />
              <ConfirmRow label="Exit type" value={exitType} />
              <ConfirmRow label="Last working day" value={lastWorkingDay} />
              <ConfirmRow label="Reason" value={reason.trim()} />

              {remarks.trim() && (
                <ConfirmRow label="Remarks" value={remarks.trim()} />
              )}

              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Clearance steps
                </p>

                <p className="mt-1 text-sm text-slate-700">{tasks.length}</p>

                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {tasks.map((task) => (
                    <li
                      key={task}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                    >
                      {task}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/60 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                disabled={submitting}
                className="h-10 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Back
              </button>

              <button
                type="button"
                onClick={() => void confirmCreate()}
                disabled={submitting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Saving...
                  </>
                ) : (
                  "Confirm & create"
                )}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-0.5 break-words text-slate-700">{value}</p>
    </div>
  );
}
