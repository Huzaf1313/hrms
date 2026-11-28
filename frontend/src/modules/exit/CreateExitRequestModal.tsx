import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LogOut, Plus, X } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { SELECT_CLASS, INPUT_CLASS, useDialogA11y } from "./exitUiUtils";
import { adminExitRequestService } from "./exitRequestService";
import { employeeService } from "../employees/employeeService";
import { ApiError } from "../../services/api";
import { EXIT_TYPES } from "./types";
import type { ExitType } from "./types";
import type { Employee } from "../employees/types";

const LABEL_CLASS = "mb-1.5 block text-[12px] font-medium text-[#4B5563]";

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

  const formDialogRef = useRef<HTMLDivElement | null>(null);
  const confirmDialogRef = useRef<HTMLDivElement | null>(null);

  useDialogA11y(!isConfirming, formDialogRef, () => {
    if (!submitting) onClose();
  });
  useDialogA11y(isConfirming, confirmDialogRef, () => {
    if (!submitting) setIsConfirming(false);
  });

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting && !isConfirming) onClose();
      }}
    >
      <div
        ref={formDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-exit-dialog-title"
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2px] border border-[#E5E7EB] bg-white shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#FDE8E8]">
              <LogOut className="h-4 w-4 text-[#9B1C1C]" />
            </span>
            <div>
              <h2
                id="create-exit-dialog-title"
                className="text-[16px] font-semibold text-[#111827]"
              >
                {lockedType ? `Initiate ${lockedType}` : "Create Exit Request"}
              </h2>
              <p className="mt-0.5 text-xs text-[#4B5563]">
                Record a departure raised by HR rather than the employee.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-8 w-8 items-center justify-center rounded text-[#6B7280] transition hover:bg-[#F0F1EE] hover:text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="exit-employee" className={LABEL_CLASS}>
                  Employee <span className="text-[#9B1C1C]">*</span>
                </label>
                <div className="relative">
                  <select
                    id="exit-employee"
                    value={employeeId}
                    disabled={submitting || loadingEmployees}
                    onChange={(event) => setEmployeeId(event.target.value)}
                    className={`${SELECT_CLASS} rounded`}
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
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" />
                </div>
              </div>

              <div>
                <label htmlFor="exit-type" className={LABEL_CLASS}>
                  Exit Type <span className="text-[#9B1C1C]">*</span>
                </label>
                <div className="relative">
                  <select
                    id="exit-type"
                    value={exitType}
                    disabled={submitting || Boolean(lockedType)}
                    onChange={(event) => setExitType(event.target.value as ExitType)}
                    className={`${SELECT_CLASS} rounded`}
                  >
                    {EXIT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" />
                </div>
              </div>

              <div>
                <label htmlFor="exit-lwd" className={LABEL_CLASS}>
                  Last Working Day <span className="text-[#9B1C1C]">*</span>
                </label>
                <input
                  id="exit-lwd"
                  type="date"
                  value={lastWorkingDay}
                  disabled={submitting}
                  onChange={(event) => setLastWorkingDay(event.target.value)}
                  className={`${INPUT_CLASS} rounded`}
                />
              </div>

              <div>
                <label htmlFor="exit-reason" className={LABEL_CLASS}>
                  Reason <span className="text-[#9B1C1C]">*</span>
                </label>
                <input
                  id="exit-reason"
                  type="text"
                  maxLength={200}
                  value={reason}
                  disabled={submitting}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="e.g. Company restructuring"
                  className={`${INPUT_CLASS} rounded`}
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
                className="w-full resize-none rounded border border-[#E5E7EB] bg-white p-3 text-[12px] text-[#111827] outline-none transition placeholder:text-[#7B8794] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0]"
              />
            </div>

            <div>
              <p className={LABEL_CLASS}>Clearance Checklist</p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {DEFAULT_HANDOVER.map((task) => {
                  const checked = tasks.includes(task);

                  return (
                    <span
                      key={task}
                      className={`inline-flex items-center rounded-full border text-[12px] font-medium transition ${
                        checked
                          ? "border-[#2F5FD0] bg-[#2F5FD0] text-white"
                          : "border-[#E5E7EB] bg-white text-[#4B5563]"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={submitting || isConfirming}
                        onClick={() => toggleTask(task)}
                        className="px-3 py-1 text-left cursor-pointer disabled:cursor-not-allowed"
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
                      className={`inline-flex items-center rounded-full border text-[12px] font-medium transition ${
                        checked
                          ? "border-[#2F5FD0] bg-[#2F5FD0] text-white"
                          : "border-[#E5E7EB] bg-white text-[#4B5563]"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={submitting || isConfirming}
                        onClick={() => toggleTask(task)}
                        className="px-3 py-1 text-left cursor-pointer disabled:cursor-not-allowed"
                      >
                        {task}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCustomTask(task)}
                        disabled={submitting || isConfirming}
                        aria-label={`Remove ${task}`}
                        title={`Remove ${task}`}
                        className="pr-2.5 pl-0.5 opacity-70 transition hover:opacity-100 disabled:cursor-not-allowed"
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
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-[#2F5FD0] text-[#2F5FD0] transition hover:bg-[#E8EEFB] disabled:cursor-not-allowed disabled:opacity-50"
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
                    className={`${INPUT_CLASS} flex-1 rounded`}
                  />

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={addCustomTask}
                    disabled={submitting || isConfirming || !customTaskDraft.trim()}
                    className="h-8 px-3 rounded text-[12px] font-medium shadow-none shrink-0"
                  >
                    Add
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomTaskDraft("");
                      setCustomTaskError("");
                      setShowCustomTaskInput(false);
                    }}
                    disabled={submitting || isConfirming}
                    aria-label="Cancel adding clearance step"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#E4E6E1] bg-white text-[#6B7280] transition hover:bg-[#F0F1EE] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {customTaskError && (
                <p className="mt-1.5 text-[11px] font-medium text-[#9B1C1C]">
                  {customTaskError}
                </p>
              )}

              <p className="mt-2 text-[11px] text-[#6B7280]">
                Selected steps ({tasks.length} of {availableTasks.length}) are
                attached as the request&apos;s handover tasks.
              </p>
            </div>

            {error && (
              <p className="rounded-[2px] border border-[#F8B4B4] bg-[#FDE8E8] px-4 py-3 text-xs text-[#9B1C1C]">
                {error}
              </p>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] bg-[#F9FAFB] px-6 py-3.5">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
              className="h-8 px-3.5 rounded text-[12px] font-medium shadow-none"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submitting}
              isLoading={submitting}
              className="h-8 px-3.5 rounded text-[12px] font-medium shadow-none"
            >
              Create Request
            </Button>
          </footer>
        </form>
      </div>

      {/* Confirmation dialog */}
      {isConfirming && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setIsConfirming(false);
            }
          }}
        >
          <div
            ref={confirmDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-exit-dialog-title"
            className="w-full max-w-md overflow-hidden rounded-[2px] border border-[#E5E7EB] bg-white shadow-xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#FEF3C7]">
                  <LogOut className="h-4 w-4 text-[#92400E]" />
                </span>
                <div>
                  <h3
                    id="confirm-exit-dialog-title"
                    className="text-[15px] font-semibold text-[#111827]"
                  >
                    Create this exit request?
                  </h3>
                  <p className="mt-0.5 text-xs text-[#4B5563]">
                    This starts clearance for the employee below.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                disabled={submitting}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#6B7280] transition hover:bg-[#F0F1EE] hover:text-[#111827] disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-2.5 px-6 py-5 text-[13px]">
              <ConfirmRow label="Employee" value={employeeLabel} />
              <ConfirmRow label="Exit type" value={exitType} />
              <ConfirmRow label="Last working day" value={lastWorkingDay} />
              <ConfirmRow label="Reason" value={reason.trim()} />

              {remarks.trim() && (
                <ConfirmRow label="Remarks" value={remarks.trim()} />
              )}

              <div className="grid grid-cols-[120px_1fr] items-start gap-2 pt-1">
                <p className="text-xs font-medium text-[#6B7280]">
                  Clearance steps
                </p>

                <div>
                  <p className="text-[13px] font-medium text-[#111827] tabular-nums">{tasks.length}</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {tasks.map((task) => (
                      <li
                        key={task}
                        className="rounded-full bg-[#F3F4F6] border border-[#E5E7EB] px-2.5 py-0.5 text-[11px] font-medium text-[#4B5563]"
                      >
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] bg-[#F9FAFB] px-6 py-3.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfirming(false)}
                disabled={submitting}
                className="h-8 px-3.5 rounded text-[12px] font-medium shadow-none"
              >
                Back
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => void confirmCreate()}
                disabled={submitting}
                isLoading={submitting}
                className="h-8 px-3.5 rounded text-[12px] font-medium shadow-none"
              >
                Confirm &amp; create
              </Button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-baseline gap-2">
      <p className="text-xs font-medium text-[#6B7280]">{label}</p>
      <p className="break-words text-left font-medium text-[#111827]">{value}</p>
    </div>
  );
}
