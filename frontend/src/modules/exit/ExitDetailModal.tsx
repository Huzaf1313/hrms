import { useState } from "react";
import { Download, ExternalLink, Plus, X } from "lucide-react";

import {
  EmployeeAvatar,
  ExitStatusBadge,
  ExitTypeBadge,
} from "./ExitUi";
import { formatDate, formatDateTime } from "./exitUiUtils";
import { adminExitRequestService, formatFileSize, saveBlob } from "./exitRequestService";
import { ApiError } from "../../services/api";
import type { ExitRequest, HandoverTask } from "./types";

const HANDOVER_TONE: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-700",
  "In Progress": "bg-blue-50 text-blue-700",
  Completed: "bg-emerald-50 text-emerald-700",
};

interface ExitDetailModalProps {
  request: ExitRequest;
  onClose: () => void;
  /** Fired after a successful status change so the page can refetch. */
  onChanged: (message: string) => void;
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * Mount this with `key={request.id}`.
 *
 * The local copy of the request is seeded from props rather than synced by an
 * effect, so switching to a different request remounts the dialog with clean
 * state instead of rendering the previous one for a frame.
 */
export default function ExitDetailModal({
  request,
  onClose,
  onChanged,
}: ExitDetailModalProps) {
  const [selected, setSelected] = useState<ExitRequest>(request);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [taskDraft, setTaskDraft] = useState("");
  const [showTaskInput, setShowTaskInput] = useState(false);

  const changeStatus = async (status: "In Progress" | "Completed" | "Rejected") => {
    if (status === "Rejected" && !note.trim()) {
      setActionError("Please add a reason for rejecting.");
      return;
    }

    setActing(true);
    setActionError("");

    try {
      const updated = await adminExitRequestService.updateStatus(
        selected.id,
        status,
        note.trim(),
      );

      setSelected(updated);
      setNote("");
      onChanged(`Request moved to ${status}.`);
    } catch (err) {
      setActionError(errorText(err, "Unable to update the request."));
    } finally {
      setActing(false);
    }
  };

  const download = async (attachmentId: string, name: string) => {
    try {
      saveBlob(
        await adminExitRequestService.downloadAttachment(selected.id, attachmentId),
        name,
      );
    } catch (err) {
      setActionError(errorText(err, "Unable to download the file."));
    }
  };

  const addHandoverTask = async () => {
    const task = taskDraft.trim();
    if (!task) return;

    if (task.length > 100) {
      setActionError("Keep the clearance step under 100 characters.");
      return;
    }

    if (selected.handover_tasks.length >= 10) {
      setActionError("A request can carry at most 10 clearance steps.");
      return;
    }

    if (selected.handover_tasks.some((entry) => entry.task.toLowerCase() === task.toLowerCase())) {
      setActionError("That clearance step is already on the list.");
      return;
    }

    setActing(true);
    setActionError("");

    const nextTask: HandoverTask = {
      task,
      remarks: null,
      status: "Pending",
      is_checked: false,
    };

    try {
      const updated = await adminExitRequestService.updateHandoverTasks(
        selected.id,
        [...selected.handover_tasks, nextTask],
      );
      setSelected(updated);
      setTaskDraft("");
      setShowTaskInput(false);
      onChanged("Clearance checklist updated successfully.");
    } catch (err) {
      setActionError(errorText(err, "Unable to update the clearance checklist."));
    } finally {
      setActing(false);
    }
  };

  const actionable = selected.status === "Pending" || selected.status === "In Progress";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !acting) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <EmployeeAvatar name={selected.employee_name} />

            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-slate-900">
                {selected.employee_name ?? "Unknown employee"}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>{selected.employee_id}</span>
                {selected.designation && <span>· {selected.designation}</span>}
                {selected.department_name && <span>· {selected.department_name}</span>}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <ExitTypeBadge type={selected.exit_type} />
            <ExitStatusBadge status={selected.status} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold text-slate-500">Reason</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{selected.reason}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Notice period</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {selected.notice_period_days} days
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Submitted</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {formatDateTime(selected.submitted_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Last working day</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {formatDate(selected.last_working_day)}
              </dd>
            </div>

            {selected.reporting_manager && (
              <div>
                <dt className="text-xs font-semibold text-slate-500">Reporting manager</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {selected.reporting_manager}
                </dd>
              </div>
            )}

            {selected.reviewed_at && (
              <div>
                <dt className="text-xs font-semibold text-slate-500">Reviewed</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {formatDateTime(selected.reviewed_at)}
                </dd>
              </div>
            )}

            {selected.reviewed_by && (
              <div>
                <dt className="text-xs font-semibold text-slate-500">Reviewed by</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{selected.reviewed_by}</dd>
              </div>
            )}
          </dl>

          {selected.remarks && (
            <div className="mt-5">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                Remarks
              </p>
              <p className="rounded bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                {selected.remarks}
              </p>
            </div>
          )}

          {selected.admin_note && (
            <div className="mt-5">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                HR note
              </p>
              <p className="rounded bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
                {selected.admin_note}
              </p>
            </div>
          )}

          <div className="mt-6">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Handover ({selected.handover_tasks.length})
            </h3>

            {selected.handover_tasks.length === 0 ? (
              <p className="rounded bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No handover tasks were listed for this request.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded border border-slate-200">
                {selected.handover_tasks.map((task, index) => (
                  <li
                    key={`${task.task}-${index}`}
                    className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{task.task}</p>
                      {task.remarks && (
                        <p className="mt-0.5 text-xs text-slate-500">{task.remarks}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        HANDOVER_TONE[task.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {task.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {actionable && (
              <div className="mt-3">
                {!showTaskInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActionError("");
                      setShowTaskInput(true);
                    }}
                    disabled={acting || selected.handover_tasks.length >= 10}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-blue-300 text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Add a custom clearance step"
                    title="Add a custom clearance step"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      maxLength={100}
                      value={taskDraft}
                      onChange={(event) => setTaskDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void addHandoverTask();
                        }
                      }}
                      placeholder="Enter a clearance step"
                      aria-label="Custom clearance step"
                      className="h-9 min-w-0 flex-1 rounded border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                      type="button"
                      onClick={() => void addHandoverTask()}
                      disabled={acting || !taskDraft.trim()}
                      className="h-9 rounded bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTaskDraft("");
                        setActionError("");
                        setShowTaskInput(false);
                      }}
                      disabled={acting}
                      aria-label="Cancel adding clearance step"
                      className="inline-flex h-9 w-9 items-center justify-center rounded border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {selected.attachments.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Attachments ({selected.attachments.length})
              </h3>

              <ul className="space-y-2">
                {selected.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <button
                      type="button"
                      onClick={() => void download(attachment.id, attachment.file_name)}
                      className="inline-flex max-w-full items-center gap-2 text-sm text-blue-600 transition hover:underline"
                    >
                      <Download className="h-4 w-4 shrink-0" />
                      <span className="truncate">{attachment.file_name}</span>
                      <span className="shrink-0 text-slate-400">
                        ({formatFileSize(attachment.file_size)})
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {actionable && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <textarea
                className="h-20 w-full resize-none rounded border border-slate-200 p-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                maxLength={500}
                placeholder="Note to the employee (required when rejecting)"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />

              <div className="mt-3 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => void changeStatus("Rejected")}
                  className="rounded border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  Reject
                </button>

                {selected.status === "Pending" ? (
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => void changeStatus("In Progress")}
                    className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    Approve &amp; Start Clearance
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => void changeStatus("Completed")}
                    className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Mark Completed
                  </button>
                )}
              </div>
            </div>
          )}

          {!actionable && (
            <p className="mt-6 flex items-center gap-2 rounded bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <ExternalLink className="h-4 w-4 shrink-0" />
              This request is {selected.status.toLowerCase()} and can no longer be actioned.
            </p>
          )}

          {actionError && (
            <p className="mt-4 rounded border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {actionError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
