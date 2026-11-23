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

const PILL: Record<StepState, string> = {
  Completed: "bg-emerald-50 text-emerald-700",
  "In Progress": "bg-blue-50 text-blue-700",
  Pending: "bg-slate-100 text-slate-600",
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
    "flex w-full items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left text-sm font-medium";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <LogOut className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Exit / Offboarding</h1>
          <p className="text-sm text-slate-500">
            Manage your resignation, clearance and final settlement process.
          </p>
        </div>
      </div>

      {/* Progress stepper */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-2 md:grid-cols-4">
        {STEPPER.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <div key={label} className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  done
                    ? "bg-emerald-500 text-white"
                    : current
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`text-sm ${current ? "font-semibold text-blue-600" : "text-slate-600"}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">My Resignation Request</h2>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading…</p>
          ) : !request ? (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-5">
              <p className="text-sm text-slate-600">
                You haven&apos;t submitted a resignation request. If you&apos;re planning to leave,
                you can start one here.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <FileText className="h-5 w-5" />
                </div>
                <ExitStatusBadge status={request.status} />
              </div>

              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[140px_1fr]">
                <dt className="text-slate-500">Request ID</dt>
                <dd className="font-medium text-slate-900">{request.request_number ?? request.id}</dd>
                <dt className="text-slate-500">Requested Date</dt>
                <dd className="font-medium text-slate-900">{formatExitDate(request.submitted_at)}</dd>
                <dt className="text-slate-500">Last Working Day</dt>
                <dd className="font-medium text-slate-900">{formatExitDate(request.last_working_day)}</dd>
                <dt className="text-slate-500">Reason</dt>
                <dd className="font-medium text-slate-900">{request.reason}</dd>
                {request.status === "Rejected" && request.admin_note && (
                  <>
                    <dt className="text-slate-500">HR Note</dt>
                    <dd className="text-slate-900">{request.admin_note}</dd>
                  </>
                )}
              </dl>

              {request.status === "Pending" && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() => void handleCancel()}
                    className="rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
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
              className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {request ? "Start New Resignation" : "Start Resignation"}
            </Link>
          )}

          {cancelConfirmOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="cancel-exit-title"
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100">
                    <LogOut className="h-5 w-5 text-red-600" />
                  </div>

                  <div>
                    <h3
                      id="cancel-exit-title"
                      className="text-lg font-semibold text-slate-900"
                    >
                      Cancel Resignation Request?
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Are you sure you want to cancel your resignation request?
                      This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() => setCancelConfirmOpen(false)}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Keep Request
                  </button>

                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() => void confirmCancel()}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cancelling ? "Cancelling..." : "Yes, Cancel Request"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Quick Links</h2>
          <div className="mt-4 space-y-2">
            <button type="button" disabled className={`${linkClass} cursor-not-allowed text-slate-400`}>
              View Clearance Checklist
              <span className="ml-auto text-xs font-normal">Coming soon</span>
            </button>
            <button type="button" disabled className={`${linkClass} cursor-not-allowed text-slate-400`}>
              View Final Settlement Details
              <span className="ml-auto text-xs font-normal">Coming soon</span>
            </button>
            <button
              type="button"
              disabled={!request || request.attachments.length === 0}
              onClick={() => void downloadLetter()}
              className={`${linkClass} text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent`}
            >
              Download Resignation Letter
              <Download className="ml-auto h-4 w-4" />
            </button>
            <a href={`mailto:${HR_EMAIL}`} className={`${linkClass} text-blue-700 hover:bg-blue-50`}>
              Contact HR
              <Mail className="ml-auto h-4 w-4" />
            </a>
          </div>
        </section>
      </div>

      {request && showProgress && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Exit Process Overview</h2>
          <p className="text-sm text-slate-500">Track your offboarding progress and complete pending tasks.</p>

          <ul className="mt-4 space-y-3">
            {buildOverview(request).map((item) => (
              <li
                key={item.title}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.text}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PILL[item.state]}`}>
                    {item.state}
                  </span>
                  <span className="w-24 text-right text-xs text-slate-500">
                    {item.date ? formatExitDate(item.date) : "TBD"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {request && !showProgress && (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          This request is {request.status.toLowerCase()}, so there are no further exit steps to complete.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Documents to Submit</h2>
            {request && active && pendingDocs > 0 && (
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                {pendingDocs} Pending
              </span>
            )}
          </div>

          {!request || !showProgress ? (
            <p className="mt-4 text-sm text-slate-500">
              Required documents appear here once you have an active resignation request.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {request.documents.map((doc) => (
                <li key={doc.key} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{doc.label}</p>
                      {doc.status === "Submitted" ? (
                        <button
                          type="button"
                          onClick={() => void downloadDocument(doc.key, doc.file_name ?? doc.label)}
                          className="block max-w-full truncate text-xs text-emerald-600 hover:underline"
                        >
                          Submitted · {doc.file_name}
                        </button>
                      ) : (
                        <p className="text-xs text-slate-500">{doc.required ? "Required" : "Optional"}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!active || uploadingKey === doc.key}
                    onClick={() => chooseFile(doc.key)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
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
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Contact HR</h2>
          <div className="mt-4 rounded-xl bg-blue-50/60 p-4">
            <p className="text-sm font-medium text-blue-700">Need help with the exit process?</p>
            <p className="text-sm text-slate-500">Contact our HR team for any queries or support.</p>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p className="flex items-center gap-3"><Mail className="h-4 w-4 text-slate-500" /> {HR_EMAIL}</p>
            <p className="flex items-center gap-3"><Phone className="h-4 w-4 text-slate-500" /> {HR_PHONE}</p>
            <p className="flex items-center gap-3"><Clock3 className="h-4 w-4 text-slate-500" /> {HR_HOURS}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default EmployeeExit;
