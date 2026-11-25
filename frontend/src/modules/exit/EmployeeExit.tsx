import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  LogOut,
  Mail,
  Phone,
  Upload,
} from "lucide-react";
import ExitStatusBadge from "./ExitStatusBadge";
import { ApiError } from "../../services/api";
import {
  exitRequestService,
  formatExitDate,
  saveBlob,
} from "./exitRequestService";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_SIZE,
} from "./types";
import type { ExitRequest } from "./types";

// Edit these to your company's HR contact details.
const HR_EMAIL = "hr@yourcompany.com";
const HR_PHONE = "+91 98765 43210";
const HR_HOURS = "Mon - Fri, 9:00 AM - 6:00 PM";

const STEPPER = ["Resignation", "Clearance", "Final Settlement", "Exit Complete"];

type StepState = "Completed" | "In Progress" | "Pending";

const PILL: Record<StepState, { pill: string; dot: string }> = {
  Completed: {
    pill: "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]",
    dot: "bg-[#03543F]",
  },
  "In Progress": {
    pill: "bg-[#E8EEFB] text-[#2F5FD0]",
    dot: "bg-[#2F5FD0]",
  },
  Pending: {
    pill: "bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]",
    dot: "bg-[#7B8794]",
  },
};

function isActive(request: ExitRequest) {
  return request.status === "Pending" || request.status === "In Progress";
}

// Index of the step being worked on. 4 means everything is done.
function currentStep(request: ExitRequest) {
  if (request.status === "Completed") return 4;
  if (request.status === "In Progress") return 1;
  if (request.status === "Pending") return 0;
  return -1;
}

// Steps 2-5 are derived from the request status (and the real document
// uploads for Document Handover) until clearance and settlement have their
// own backend.
function buildOverview(request: ExitRequest) {
  const done = request.status === "Completed";
  const submitted = request.documents.filter((d) => d.status === "Submitted").length;
  const total = request.documents.length;

  const handover: StepState =
    done || (total > 0 && submitted === total)
      ? "Completed"
      : submitted > 0
        ? "In Progress"
        : "Pending";

  const doneDate = done ? request.reviewed_at : null;

  return [
    {
      title: "Resignation Request",
      text: "You have submitted your resignation.",
      state: "Completed" as StepState,
      date: request.submitted_at,
    },
    {
      title: "Account & Access Deactivation",
      text: "Your system access will be revoked after approval.",
      state: (done ? "Completed" : request.status === "In Progress" ? "In Progress" : "Pending") as StepState,
      date: doneDate,
    },
    {
      title: "Document Handover",
      text: "Please submit all required documents and assets.",
      state: handover,
      date: null,
    },
    {
      title: "Final Settlement",
      text: "Your salary, leave encashment and deductions will be processed.",
      state: (done ? "Completed" : "Pending") as StepState,
      date: doneDate,
    },
    {
      title: "Exit Complete",
      text: "You will receive a confirmation once the process is completed.",
      state: (done ? "Completed" : "Pending") as StepState,
      date: doneDate,
    },
  ];
}

function errorText(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

function EmployeeExit() {
  const [request, setRequest] = useState<ExitRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await exitRequestService.listMine({ page: 1, limit: 1 });
      setRequest(data.items[0] ?? null);
      setError("");
    } catch (err) {
      setError(errorText(err, "Unable to load your exit request."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCancel = () => {
    if (!request || cancelling) return;
    setCancelConfirmOpen(true);
  };

  const confirmCancel = async () => {
    if (!request || cancelling) return;

    setCancelling(true);
    setError("");

    try {
      setRequest(await exitRequestService.cancel(request.id));
      setCancelConfirmOpen(false);
    } catch (err) {
      setError(errorText(err, "Unable to cancel the request."));
    } finally {
      setCancelling(false);
    }
  };

  const chooseFile = (key: string) => {
    pendingKey.current = key;
    fileInput.current?.click();
  };

  const handleFileChosen = async (file: File | undefined) => {
    const key = pendingKey.current;
    if (!file || !key || !request) return;

    const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
      setError("Only PDF, DOC, DOCX, JPG and PNG files are allowed.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setError(`${file.name} is larger than 10 MB.`);
      return;
    }

    setUploadingKey(key);
    setError("");
    try {
      setRequest(await exitRequestService.uploadDocument(request.id, key, file));
    } catch (err) {
      setError(errorText(err, "Unable to upload the document."));
    } finally {
      setUploadingKey(null);
    }
  };

  const downloadDocument = async (key: string, name: string) => {
    if (!request) return;
    try {
      saveBlob(await exitRequestService.downloadMyDocument(request.id, key), name);
    } catch (err) {
      setError(errorText(err, "Unable to download the document."));
    }
  };

  const downloadLetter = async () => {
    const first = request?.attachments[0];
    if (!request || !first) return;
    try {
      saveBlob(
        await exitRequestService.downloadMyAttachment(request.id, first.id),
        first.file_name,
      );
    } catch (err) {
      setError(errorText(err, "Unable to download the file."));
    }
  };

  const step = request ? currentStep(request) : -1;
  const active = request ? isActive(request) : false;
  const showProgress = request ? active || request.status === "Completed" : false;
  const canStartNew = !request || request.status === "Rejected" || request.status === "Cancelled";
  const pendingDocs = request ? request.documents.filter((d) => d.status === "Pending").length : 0;

  const linkClass =
    "flex w-full items-center gap-3 rounded-md border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-left text-[12px] font-medium transition";

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-lg border border-[#E5E7EB] shadow-none">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#E8EEFB] text-[#2F5FD0]">
            <LogOut className="h-4 w-4 shrink-0" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[18px] font-semibold text-[#111827]">Exit / Offboarding</h1>
            <p className="text-xs text-[#4B5563]">
              Manage your resignation, clearance and final settlement process.
            </p>
          </div>
        </div>
      </div>

      {/* Progress stepper */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-none sm:grid-cols-2 md:grid-cols-4">
        {STEPPER.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <div key={label} className="flex items-center gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${done
                    ? "bg-[#03543F] text-white"
                    : current
                      ? "bg-[#2F5FD0] text-white"
                      : "bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]"
                  }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`text-[13px] ${current ? "font-semibold text-[#2F5FD0]" : "font-medium text-[#4B5563]"}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg border border-[#F8B4B4] bg-[#FDE8E8] px-4 py-2.5 text-xs text-[#9B1C1C]">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <section className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden shadow-none">
          <div className="border-b border-[#E5E7EB] bg-white px-6 py-3.5">
            <h2 className="text-[13px] font-semibold text-[#111827]">My Resignation Request</h2>
          </div>

          <div className="p-5">
            {loading ? (
              <p className="text-xs text-[#6B7280]">Loading…</p>
            ) : !request ? (
              <div className="rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-5">
                <p className="text-xs text-[#4B5563]">
                  You haven&apos;t submitted a resignation request. If you&apos;re planning to leave,
                  you can start one here.
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#E8EEFB] text-[#2F5FD0]">
                    <FileText className="h-4 w-4" />
                  </div>
                  <ExitStatusBadge status={request.status} />
                </div>

                <dl className="mt-4 grid gap-2 text-[12px] sm:grid-cols-[140px_1fr]">
                  <dt className="text-[#6B7280]">Request ID</dt>
                  <dd className="font-medium text-[#111827] tabular-nums">{request.request_number ?? request.id}</dd>
                  <dt className="text-[#6B7280]">Requested Date</dt>
                  <dd className="font-medium text-[#111827] tabular-nums">{formatExitDate(request.submitted_at)}</dd>
                  <dt className="text-[#6B7280]">Last Working Day</dt>
                  <dd className="font-medium text-[#111827] tabular-nums">{formatExitDate(request.last_working_day)}</dd>
                  <dt className="text-[#6B7280]">Reason</dt>
                  <dd className="font-medium text-[#111827]">{request.reason}</dd>
                  {request.status === "Rejected" && request.admin_note && (
                    <>
                      <dt className="text-[#6B7280]">HR Note</dt>
                      <dd className="text-[#111827]">{request.admin_note}</dd>
                    </>
                  )}
                </dl>

                {request.status === "Pending" && (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      disabled={cancelling}
                      onClick={() => void handleCancel()}
                      className="h-8 rounded-[6px] border border-[#F8B4B4] bg-white px-3 text-[12px] font-medium text-[#9B1C1C] hover:bg-[#FDE8E8] disabled:opacity-50"
                    >
                      {cancelling ? "Cancelling…" : "Cancel Request"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!loading && canStartNew && (
              <Link
                to="/employee/exit/resignation"
                className="mt-4 inline-flex h-[34px] items-center rounded-[6px] bg-[#2F5FD0] px-4 text-[13px] font-medium text-white hover:bg-[#264FB0]"
              >
                {request ? "Start New Resignation" : "Start Resignation"}
              </Link>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden shadow-none">
          <div className="border-b border-[#E5E7EB] bg-white px-6 py-3.5">
            <h2 className="text-[13px] font-semibold text-[#111827]">Quick Links</h2>
          </div>
          <div className="space-y-2 p-5">
            <button type="button" disabled className={`${linkClass} cursor-not-allowed bg-[#F6F7F5] text-[#7B8794]`}>
              View Clearance Checklist
              <span className="ml-auto text-[11px] font-normal">Coming soon</span>
            </button>
            <button type="button" disabled className={`${linkClass} cursor-not-allowed bg-[#F6F7F5] text-[#7B8794]`}>
              View Final Settlement Details
              <span className="ml-auto text-[11px] font-normal">Coming soon</span>
            </button>
            <button
              type="button"
              disabled={!request || request.attachments.length === 0}
              onClick={() => void downloadLetter()}
              className={`${linkClass} text-[#2F5FD0] hover:bg-[#E8EEFB] disabled:cursor-not-allowed disabled:bg-[#F6F7F5] disabled:text-[#7B8794] disabled:hover:bg-[#F6F7F5]`}
            >
              Download Resignation Letter
              <Download className="ml-auto h-4 w-4" />
            </button>
            <a href={`mailto:${HR_EMAIL}`} className={`${linkClass} text-[#2F5FD0] hover:bg-[#E8EEFB]`}>
              Contact HR
              <Mail className="ml-auto h-4 w-4" />
            </a>
          </div>
        </section>
      </div>

      {request && showProgress && (
        <section className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden shadow-none">
          <div className="border-b border-[#E5E7EB] bg-white px-6 py-3.5">
            <h2 className="text-[13px] font-semibold text-[#111827]">Exit Process Overview</h2>
            <p className="mt-0.5 text-xs text-[#4B5563]">Track your offboarding progress and complete pending tasks.</p>
          </div>
          <ul className="divide-y divide-[#E5E7EB]">
            {buildOverview(request).map((item) => {
              const badge = PILL[item.state];
              return (
                <li
                  key={item.title}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5"
                >
                  <div>
                    <p className="text-[13px] font-medium text-[#111827]">{item.title}</p>
                    <p className="text-xs text-[#6B7280]">{item.text}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`inline-flex items-center gap-1.5 h-[22px] rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${badge.dot}`} />
                      <span>{item.state}</span>
                    </span>
                    <span className="w-24 text-right text-xs text-[#6B7280] tabular-nums">
                      {item.date ? formatExitDate(item.date) : "TBD"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {request && !showProgress && (
        <p className="rounded-lg border border-[#E5E7EB] bg-white p-4 text-xs text-[#4B5563]">
          This request is {request.status.toLowerCase()}, so there are no further exit steps to complete.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden shadow-none">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-white px-6 py-3.5">
            <h2 className="text-[13px] font-semibold text-[#111827]">Documents to Submit</h2>
            {request && active && pendingDocs > 0 && (
              <span className="rounded-full border border-[#F8B4B4] bg-[#FDE8E8] px-2 py-0.5 text-[11px] font-medium text-[#9B1C1C]">
                {pendingDocs} Pending
              </span>
            )}
          </div>

          <div className="p-5">
            {!request || !showProgress ? (
              <p className="text-xs text-[#6B7280]">
                Required documents appear here once you have an active resignation request.
              </p>
            ) : (
              <ul className="space-y-3">
                {request.documents.map((doc) => (
                  <li key={doc.key} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#E8EEFB] text-[#2F5FD0]">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-[#111827]">{doc.label}</p>
                        {doc.status === "Submitted" ? (
                          <button
                            type="button"
                            onClick={() => void downloadDocument(doc.key, doc.file_name ?? doc.label)}
                            className="block max-w-full truncate text-[11px] text-[#03543F] hover:underline"
                          >
                            Submitted · {doc.file_name}
                          </button>
                        ) : (
                          <p className="text-[11px] text-[#6B7280]">{doc.required ? "Required" : "Optional"}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!active || uploadingKey === doc.key}
                      onClick={() => chooseFile(doc.key)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] border border-[#E4E6E1] bg-white px-3 text-[12px] font-medium text-[#1F2933] hover:bg-[#F0F1EE] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingKey === doc.key ? "Uploading…" : doc.status === "Submitted" ? "Replace" : "Upload"}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <input
              ref={fileInput}
              type="file"
              hidden
              accept={ALLOWED_ATTACHMENT_EXTENSIONS.join(",")}
              onChange={(e) => {
                void handleFileChosen(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </section>

        <section className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden shadow-none">
          <div className="border-b border-[#E5E7EB] bg-white px-6 py-3.5">
            <h2 className="text-[13px] font-semibold text-[#111827]">Contact HR</h2>
          </div>
          <div className="p-5">
            <div className="rounded-md border border-[#E8EEFB] bg-[#E8EEFB] p-4">
              <p className="text-[13px] font-semibold text-[#2F5FD0]">Need help with the exit process?</p>
              <p className="mt-0.5 text-xs text-[#4B5563]">Contact our HR team for any queries or support.</p>
            </div>
            <div className="mt-4 space-y-2.5 text-[12px] text-[#4B5563]">
              <p className="flex items-center gap-3"><Mail className="h-4 w-4 text-[#6B7280]" /> {HR_EMAIL}</p>
              <p className="flex items-center gap-3"><Phone className="h-4 w-4 text-[#6B7280]" /> {HR_PHONE}</p>
              <p className="flex items-center gap-3"><Clock3 className="h-4 w-4 text-[#6B7280]" /> {HR_HOURS}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default EmployeeExit;
