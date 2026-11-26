import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, FileText, Send, UploadCloud, X } from "lucide-react";
import { ApiError } from "../../services/api";
import { exitRequestService, formatFileSize } from "./exitRequestService";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  DEFAULT_HANDOVER_TASKS,
  HANDOVER_STATUSES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_SIZE,
  NOTICE_PERIODS,
  RESIGNATION_REASONS,
} from "./types";
import type { HandoverStatus } from "./types";

interface HandoverRow {
  task: string;
  placeholder: string;
  checked: boolean;
  remarks: string;
  status: HandoverStatus;
}

// Local-time YYYY-MM-DD (toISOString would shift the date for UTC+ users).
function toISODate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function earliestLastDay(noticeDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + noticeDays);
  return toISODate(date);
}

const inputClass =
  "w-full rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[12px] text-[#111827] placeholder:text-[#7B8794] outline-none focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0]";

function EmployeeResignation() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [noticePeriod, setNoticePeriod] = useState<number>(30);
  const [lastWorkingDay, setLastWorkingDay] = useState(earliestLastDay(30));
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [tasks, setTasks] = useState<HandoverRow[]>(
    DEFAULT_HANDOVER_TASKS.map((t) => ({
      task: t.task,
      placeholder: t.placeholder,
      checked: false,
      remarks: "",
      status: "Pending",
    })),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hasActiveRequest, setHasActiveRequest] = useState(false);

  useEffect(() => {
    let cancelled = false;

    exitRequestService
      .listMine({ page: 1, limit: 5 })
      .then((data) => {
        if (!cancelled) {
          setHasActiveRequest(
            data.items.some((r) => r.status === "Pending" || r.status === "In Progress"),
          );
        }
      })
      .catch(() => undefined); // the server re-checks on submit

    return () => {
      cancelled = true;
    };
  }, []);

  const minDay = earliestLastDay(noticePeriod);

  const handleNoticeChange = (days: number) => {
    setNoticePeriod(days);
    const min = earliestLastDay(days);
    if (lastWorkingDay < min) setLastWorkingDay(min);
  };

  const updateTask = (index: number, patch: Partial<HandoverRow>) => {
    setTasks((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addFiles = (incoming: File[]) => {
    const next = [...files];

    for (const file of incoming) {
      const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;

      if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
        setError(`${file.name}: only PDF, DOC, DOCX, JPG and PNG files are allowed.`);
        return;
      }
      if (file.size > MAX_ATTACHMENT_SIZE) {
        setError(`${file.name} is larger than 10 MB.`);
        return;
      }
      if (next.length >= MAX_ATTACHMENTS) {
        setError(`You can attach at most ${MAX_ATTACHMENTS} files.`);
        return;
      }
      next.push(file);
    }

    setError("");
    setFiles(next);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  };

  const handleSubmit = async () => {
    setError("");

    if (!lastWorkingDay || lastWorkingDay < minDay) {
      setError("Last working day must be on or after the end of your notice period.");
      return;
    }
    if (!reason) {
      setError("Please select a resignation reason.");
      return;
    }
    if (reason === "Other" && !remarks.trim()) {
      setError("Please add remarks when the reason is 'Other'.");
      return;
    }
    if (!confirmed) {
      setError("Please confirm that the information provided is true and correct.");
      return;
    }

    const form = new FormData();
    form.append("last_working_day", lastWorkingDay);
    form.append("notice_period_days", String(noticePeriod));
    form.append("reason", reason);
    form.append("remarks", remarks.trim());
    form.append("confirmed", "true");
    form.append(
      "handover_tasks",
      JSON.stringify(
        tasks.map((t) => ({
          task: t.task,
          remarks: t.remarks.trim() || null,
          status: t.status,
          is_checked: t.checked,
        })),
      ),
    );
    files.forEach((file) => form.append("files", file));

    setSubmitting(true);
    try {
      await exitRequestService.submit(form);
      navigate("/employee/exit");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to submit your resignation. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 w-full xl:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1 bg-white p-5 rounded-lg border border-[#E5E7EB] shadow-none">
          <Link
            to="/employee/exit"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#4B5563] hover:text-[#111827] w-fit"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Exit / Offboarding
          </Link>
          <h1 className="mt-1 text-[18px] font-semibold text-[#111827]">Resignation Request</h1>
          <p className="text-xs text-[#4B5563]">
            Submit your resignation request and our HR team will review it.
          </p>
        </div>

        {hasActiveRequest && (
          <div className="rounded-lg border border-[#FCD34D] bg-[#FEF3C7] p-4 text-xs text-[#92400E]">
            You already have an active resignation request, so a new one can&apos;t be submitted.
          </div>
        )}

        <section className="space-y-6 rounded-lg border border-[#E5E7EB] bg-white p-6 shadow-none">
          <h2 className="text-[13px] font-semibold text-[#111827]">Resignation Details</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-[12px] font-medium text-[#4B5563]">
              Notice Period <span className="text-[#9B1C1C]">*</span>
              <select
                className={`${inputClass} mt-1.5 h-8`}
                value={noticePeriod}
                onChange={(e) => handleNoticeChange(Number(e.target.value))}
              >
                {NOTICE_PERIODS.map((days) => (
                  <option key={days} value={days}>{days} Days</option>
                ))}
              </select>
            </label>

            <label className="block text-[12px] font-medium text-[#4B5563]">
              Last Working Day <span className="text-[#9B1C1C]">*</span>
              <input
                type="date"
                className={`${inputClass} mt-1.5 h-8`}
                value={lastWorkingDay}
                min={minDay}
                onChange={(e) => setLastWorkingDay(e.target.value)}
              />
            </label>

            <label className="block text-[12px] font-medium text-[#4B5563]">
              Resignation Reason <span className="text-[#9B1C1C]">*</span>
              <select
                className={`${inputClass} mt-1.5 h-8`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="">Select reason</option>
                {RESIGNATION_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>

            <label className="block text-[12px] font-medium text-[#4B5563]">
              Remarks <span className="font-normal text-[#7B8794]">(Optional)</span>
              <textarea
                className={`${inputClass} mt-1.5 h-24 resize-none`}
                maxLength={500}
                placeholder="Add any additional comments..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
              <span className="block text-right text-[11px] text-[#6B7280] tabular-nums">{remarks.length}/500</span>
            </label>
          </div>

          <div>
            <h3 className="text-[13px] font-semibold text-[#111827]">Hand over / Important Tasks</h3>
            <p className="text-xs text-[#4B5563]">
              Help us plan the transition by sharing your handover details and important tasks.
            </p>

            <div className="mt-3 overflow-x-auto rounded-lg border border-[#E5E7EB]">
              <table className="w-full min-w-[620px] border-collapse text-[12px]">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-left text-[11px] font-semibold uppercase tracking-wider text-[#4B5563]">
                  <tr className="h-10">
                    <th className="px-4 py-0 bg-[#F9FAFB] align-middle">Task / Handover Item</th>
                    <th className="px-4 py-0 bg-[#F9FAFB] align-middle">Remarks (Optional)</th>
                    <th className="px-4 py-0 bg-[#F9FAFB] align-middle">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] bg-white">
                  {tasks.map((row, index) => (
                    <tr key={row.task} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-4 py-3">
                        <label className="flex items-center gap-3 text-[#111827]">
                          <input
                            type="checkbox"
                            checked={row.checked}
                            onChange={(e) => updateTask(index, { checked: e.target.checked })}
                            className="h-4 w-4 rounded border-[#E5E7EB] text-[#2F5FD0] focus:ring-[#2F5FD0]"
                          />
                          {row.task}
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className={`${inputClass} h-8`}
                          maxLength={300}
                          placeholder={row.placeholder}
                          value={row.remarks}
                          onChange={(e) => updateTask(index, { remarks: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className={`${inputClass} h-8`}
                          value={row.status}
                          onChange={(e) => updateTask(index, { status: e.target.value as HandoverStatus })}
                        >
                          {HANDOVER_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-[13px] font-semibold text-[#111827]">
              Attachment <span className="text-xs font-normal text-[#7B8794]">(Optional)</span>
            </h3>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="mt-3 flex flex-col items-center gap-1 rounded-lg border-2 border-dashed border-[#E5E7EB] bg-[#F9FAFB] px-4 py-6 text-center"
            >
              <UploadCloud className="h-6 w-6 text-[#2F5FD0]" />
              <p className="text-xs text-[#4B5563]">
                Drag and drop files here, or{" "}
                <button
                  type="button"
                  className="font-medium text-[#2F5FD0] hover:underline"
                  onClick={() => fileInput.current?.click()}
                >
                  click to browse
                </button>
              </p>
              <p className="text-[11px] text-[#6B7280]">
                Allowed formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB each, up to {MAX_ATTACHMENTS} files)
              </p>
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                accept={ALLOWED_ATTACHMENT_EXTENSIONS.join(",")}
                onChange={handleFileInput}
              />
            </div>

            {files.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs text-[#4B5563]"
                  >
                    <FileText className="h-4 w-4 text-[#2F5FD0]" />
                    {file.name}
                    <span className="text-[#6B7280] tabular-nums">({formatFileSize(file.size)})</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setFiles((list) => list.filter((_, i) => i !== index))}
                    >
                      <X className="h-3.5 w-3.5 text-[#6B7280] hover:text-[#9B1C1C]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-[#F8B4B4] bg-[#FDE8E8] px-4 py-2.5 text-xs text-[#9B1C1C]">{error}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E5E7EB] pt-5">
            <label className="flex items-center gap-2 text-xs text-[#4B5563]">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="h-4 w-4 rounded border-[#E5E7EB] text-[#2F5FD0] focus:ring-[#2F5FD0]"
              />
              I confirm that the information provided is true and correct.
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate("/employee/exit")}
                className="h-[34px] rounded-[6px] border border-[#E4E6E1] bg-white px-4 text-[13px] font-medium text-[#1F2933] hover:bg-[#F0F1EE]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || hasActiveRequest}
                onClick={() => void handleSubmit()}
                className="inline-flex h-[34px] items-center gap-2 rounded-[6px] bg-[#2F5FD0] px-4 text-[13px] font-medium text-white hover:bg-[#264FB0] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden shadow-none">
          <div className="border-b border-[#E5E7EB] bg-white px-5 py-3.5">
            <h2 className="text-[13px] font-semibold text-[#111827]">Resignation Process</h2>
          </div>
          <ol className="space-y-4 p-5 text-[12px]">
            {[
              ["Submit Request", "Fill in the resignation form and submit."],
              ["HR Review", "HR will review your request and details."],
              ["Clearance Process", "Complete pending tasks and handover."],
              ["Final Settlement", "Get your dues and final documents."],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E8EEFB] text-xs font-semibold text-[#2F5FD0] tabular-nums">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-medium text-[#111827]">{title}</span>
                  <span className="text-[#6B7280]">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden shadow-none text-[12px]">
          <div className="border-b border-[#E5E7EB] bg-white px-5 py-3.5">
            <h2 className="text-[13px] font-semibold text-[#111827]">Key Information</h2>
          </div>
          <div className="p-5">
            <p className="font-medium text-[#111827]">Notice Period</p>
            <p className="text-[#6B7280]">
              Your last working day must be at least your notice period from today.
            </p>
            <p className="mt-3 font-medium text-[#111827]">Final Settlement</p>
            <p className="text-[#6B7280]">Processed after clearance and exit formalities.</p>
            <p className="mt-3 font-medium text-[#111827]">Documents Required</p>
            <ul className="list-disc pl-5 text-[#6B7280]">
              <li>Resignation letter</li>
              <li>Handover summary</li>
              <li>ID card / Access return</li>
            </ul>
          </div>
        </section>
      </aside>
    </div>
  );
}

export default EmployeeResignation;