import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, ExternalLink, FileSpreadsheet, Plus, X } from "lucide-react";

import { Button } from "../../components/ui/Button";
import {
  EmployeeAvatar,
  ExitStatusBadge,
  ExitTypeBadge,
} from "./ExitUi";
import { INPUT_CLASS, formatDate, formatDateTime, useDialogA11y } from "./exitUiUtils";
import { adminExitRequestService, downloadExitCsv, formatFileSize, saveBlob } from "./exitRequestService";
import { ApiError } from "../../services/api";
import type { ExitRequest, HandoverTask } from "./types";

const HANDOVER_TONE: Record<string, { pill: string; dot: string }> = {
  Pending: {
    pill: "bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]",
    dot: "bg-[#92400E]",
  },
  "In Progress": {
    pill: "bg-[#E8EEFB] text-[#2F5FD0]",
    dot: "bg-[#2F5FD0]",
  },
  Completed: {
    pill: "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]",
    dot: "bg-[#03543F]",
  },
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

  const dialogRef = useRef<HTMLDivElement | null>(null);
  useDialogA11y(true, dialogRef, () => {
    if (!acting) onClose();
  });

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
  const isTermination = selected.exit_type === "Termination";
  const timelineEvents = [
    {
      label: isTermination ? "Termination initiated" : "Resignation submitted",
      at: selected.submitted_at,
      by: selected.employee_name ?? selected.employee_id,
    },
    ...(selected.reviewed_at
      ? [
          {
            label: `Moved to ${selected.status}`,
            at: selected.reviewed_at,
            by: selected.reviewed_by ?? "HR Admin",
          },
        ]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !acting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-detail-dialog-title"
        className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-[#E5E7EB] bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <EmployeeAvatar name={selected.employee_name} />

            <div className="min-w-0">
              <h2
                id="exit-detail-dialog-title"
                className="truncate text-[16px] font-semibold text-[#111827]"
              >
                {selected.employee_name ?? "Unknown employee"}
              </h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
                <span className="tabular-nums">{selected.employee_id}</span>
                {selected.designation && <span>· {selected.designation}</span>}
                {selected.department_name && <span>· {selected.department_name}</span>}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ExitTypeBadge type={selected.exit_type} />
            <ExitStatusBadge status={selected.status} />
            <button
              type="button"
              onClick={onClose}
              disabled={acting}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#6B7280] transition hover:bg-[#F0F1EE] hover:text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Compact merged status + settlement info alert */}
          <div
            className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs leading-5 ${
              actionable
                ? "border-blue-200 bg-blue-50/80 text-blue-900"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {actionable ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            )}
            <div className="min-w-0">
              <p className="font-medium">
                {selected.employee_name ?? "This employee"} is currently{" "}
                <span className="font-semibold">{selected.status.toLowerCase()}</span>.
              </p>
              <p className="mt-0.5 text-xs opacity-85">
                Once final settlement is completed, the employee&apos;s account is marked inactive and system access is revoked.
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
            <div className="grid grid-cols-[125px_1fr] items-baseline gap-2">
              <dt className="text-xs font-medium text-[#6B7280]">Reason</dt>
              <dd className="font-medium text-[#111827] text-left">{selected.reason}</dd>
            </div>
            <div className="grid grid-cols-[125px_1fr] items-baseline gap-2">
              <dt className="text-xs font-medium text-[#6B7280]">Notice period</dt>
              <dd className="font-medium text-[#111827] text-left tabular-nums">
                {selected.notice_period_days} days
              </dd>
            </div>
            <div className="grid grid-cols-[125px_1fr] items-baseline gap-2">
              <dt className="text-xs font-medium text-[#6B7280]">Submitted</dt>
              <dd className="font-medium text-[#111827] text-left tabular-nums">
                {formatDateTime(selected.submitted_at)}
              </dd>
            </div>
            <div className="grid grid-cols-[125px_1fr] items-baseline gap-2">
              <dt className="text-xs font-medium text-[#6B7280]">Last working day</dt>
              <dd className="font-medium text-[#111827] text-left tabular-nums">
                {formatDate(selected.last_working_day)}
              </dd>
            </div>

            {selected.reporting_manager && (
              <div className="grid grid-cols-[125px_1fr] items-baseline gap-2">
                <dt className="text-xs font-medium text-[#6B7280]">Reporting manager</dt>
                <dd className="font-medium text-[#111827] text-left">
                  {selected.reporting_manager}
                </dd>
              </div>
            )}

            {selected.reviewed_at && (
              <div className="grid grid-cols-[125px_1fr] items-baseline gap-2">
                <dt className="text-xs font-medium text-[#6B7280]">Reviewed</dt>
                <dd className="font-medium text-[#111827] text-left tabular-nums">
                  {formatDateTime(selected.reviewed_at)}
                </dd>
              </div>
            )}

            {selected.reviewed_by && (
              <div className="grid grid-cols-[125px_1fr] items-baseline gap-2">
                <dt className="text-xs font-medium text-[#6B7280]">Reviewed by</dt>
                <dd className="font-medium text-[#111827] text-left">{selected.reviewed_by}</dd>
              </div>
            )}
          </dl>

          {selected.remarks && (
            <div className="mt-5">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Remarks
              </p>
              <p className="rounded bg-[#F9FAFB] border border-[#E5E7EB] px-4 py-3 text-[13px] leading-6 text-[#4B5563]">
                {selected.remarks}
              </p>
            </div>
          )}

          {selected.admin_note && (
            <div className="mt-5">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                HR note
              </p>
              <p className="rounded bg-[#E8EEFB] px-4 py-3 text-[13px] leading-6 text-[#2F5FD0]">
                {selected.admin_note}
              </p>
            </div>
          )}

          <div className="mt-6">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              Handover ({selected.handover_tasks.length})
            </h3>

            {selected.handover_tasks.length === 0 ? (
              <p className="rounded bg-[#F9FAFB] border border-[#E5E7EB] px-4 py-3 text-xs text-[#6B7280]">
                No handover tasks were listed for this request.
              </p>
            ) : (
              <ul className="divide-y divide-[#E5E7EB] rounded border border-[#E5E7EB]">
                {selected.handover_tasks.map((task, index) => {
                  const tone = HANDOVER_TONE[task.status] ?? {
                    pill: "bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]",
                    dot: "bg-[#7B8794]",
                  };

                  return (
                    <li
                      key={`${task.task}-${index}`}
                      className="flex items-start justify-between gap-3 px-4 py-2.5 text-[13px]"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[#111827]">{task.task}</p>
                        {task.remarks && (
                          <p className="mt-0.5 text-xs text-[#6B7280]">{task.remarks}</p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 h-[22px] shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tone.pill}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${tone.dot}`} />
                        <span>{task.status}</span>
                      </span>
                    </li>
                  );
                })}
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
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-[#2F5FD0] text-[#2F5FD0] transition hover:bg-[#E8EEFB] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0]"
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
                      className={`${INPUT_CLASS} flex-1 rounded`}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void addHandoverTask()}
                      disabled={acting || !taskDraft.trim()}
                      className="h-8 px-3 text-[12px] font-medium rounded shadow-none"
                    >
                      Add
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setTaskDraft("");
                        setActionError("");
                        setShowTaskInput(false);
                      }}
                      disabled={acting}
                      aria-label="Cancel adding clearance step"
                      className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#E4E6E1] text-[#6B7280] transition hover:bg-[#F0F1EE] disabled:cursor-not-allowed disabled:opacity-50"
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
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Attachments ({selected.attachments.length})
              </h3>

              <ul className="space-y-2">
                {selected.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <button
                      type="button"
                      onClick={() => void download(attachment.id, attachment.file_name)}
                      className="inline-flex max-w-full items-center gap-2 text-[13px] font-medium text-[#2F5FD0] transition hover:underline"
                    >
                      <Download className="h-4 w-4 shrink-0" />
                      <span className="truncate">{attachment.file_name}</span>
                      <span className="shrink-0 text-[#6B7280] tabular-nums">
                        ({formatFileSize(attachment.file_size)})
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isTermination && (
            <div className="rounded-xl border border-[#E5E7EB] bg-slate-50/70 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Termination Timeline
              </h3>
              <ol className="space-y-2.5">
                {timelineEvents.map((ev) => (
                  <li key={`${ev.label}-${ev.at}`} className="flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-[#111827]">{ev.label}</p>
                      <p className="text-slate-500">by {ev.by}</p>
                    </div>
                    <span className="shrink-0 text-slate-500 tabular-nums">
                      {formatDateTime(ev.at)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {actionable && (
            <div className="border-t border-[#E5E7EB] pt-5">
              <textarea
                className="h-20 w-full resize-none rounded-lg border border-[#E5E7EB] bg-white p-3 text-xs text-[#111827] outline-none transition placeholder:text-[#7B8794] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0]"
                maxLength={500}
                placeholder="Note to the employee (required when rejecting)"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadExitCsv([selected], `exit-${selected.employee_id}.csv`)}
                  leftIcon={<FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />}
                  className="h-8 px-3 rounded-lg text-xs font-medium shadow-none"
                >
                  Exit Report
                </Button>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={acting}
                    onClick={() => void changeStatus("Rejected")}
                    className="h-8 px-3 rounded-lg text-xs font-medium text-[#9B1C1C] hover:bg-[#FDE8E8] border-[#F8B4B4] hover:border-[#F8B4B4] shadow-none"
                  >
                    Reject
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={acting || selected.status !== "Pending"}
                    title={
                      selected.status !== "Pending"
                        ? "Already approved and in clearance"
                        : "Approve request and begin clearance"
                    }
                    onClick={() => void changeStatus("In Progress")}
                    className="h-8 px-3.5 rounded-lg text-xs font-medium shadow-none"
                  >
                    Approve &amp; Start Clearance
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={acting || selected.status !== "In Progress"}
                    title={
                      selected.status !== "In Progress"
                        ? "Available after clearance is started"
                        : "Process final settlement and mark completed"
                    }
                    onClick={() => void changeStatus("Completed")}
                    className="h-8 px-3.5 rounded-lg text-xs font-medium text-[#03543F] hover:bg-[#DEF7EC] border-[#BCF0DA] shadow-none"
                  >
                    Mark Completed
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!actionable && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] px-4 py-3 text-xs text-[#6B7280]">
              <span className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 shrink-0" />
                This request is {selected.status.toLowerCase()} and can no longer be actioned.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadExitCsv([selected], `exit-${selected.employee_id}.csv`)}
                leftIcon={<FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />}
                className="h-8 px-3 rounded-lg text-xs font-medium shadow-none"
              >
                Exit Report
              </Button>
            </div>
          )}

          {actionError && (
            <p className="mt-4 rounded border border-[#F8B4B4] bg-[#FDE8E8] px-4 py-3 text-xs text-[#9B1C1C]">
              {actionError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
