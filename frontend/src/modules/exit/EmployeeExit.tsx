import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  FileText,
  HelpCircle,
  LogOut,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";

import ExitStatusBadge from "./ExitStatusBadge";
import {
  exitRequestService,
  formatExitDate,
  formatFileSize,
  saveBlob,
} from "./exitRequestService";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_SIZE,
  type ExitRequest,
} from "./types";
import { ApiError } from "../../services/api";
import { getSupportContactConfig } from "../support/supportConfig";
import { Button } from "../../components/ui/Button";
import { PageHeading } from "../../components/ui/PageHeading";
import { Skeleton } from "../../components/ui/Skeleton";

const STEPPER = [
  { label: "Resignation", hint: "Request & notice submitted" },
  { label: "Clearance", hint: "Handover & access review" },
  { label: "Final Settlement", hint: "Payroll & dues check" },
  { label: "Exit Complete", hint: "Offboarding closed" },
] as const;

type StepState = "Completed" | "In Progress" | "Pending";

const PILL_STYLES: Record<StepState, { pill: string; dot: string }> = {
  Completed: {
    pill: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60",
    dot: "bg-emerald-500",
  },
  "In Progress": {
    pill: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-800/60",
    dot: "bg-blue-500",
  },
  Pending: {
    pill: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    dot: "bg-slate-400",
  },
};

function isActive(request: ExitRequest) {
  return request.status === "Pending" || request.status === "In Progress";
}

function currentStep(request: ExitRequest) {
  if (request.status === "Completed") return 4;
  if (request.status === "In Progress") return 1;
  if (request.status === "Pending") return 0;
  return -1;
}

function daysRemaining(dateStr: string | null | undefined, nowMs: number): number | null {
  if (!dateStr) return null;
  const target = Date.parse(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - nowMs) / (1000 * 60 * 60 * 24));
}

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
      text: "Your resignation request has been submitted for HR review.",
      state: "Completed" as StepState,
      date: request.submitted_at,
    },
    {
      title: "Account & Access Deactivation",
      text: "System credentials and workspace access are scheduled after approval.",
      state: (done
        ? "Completed"
        : request.status === "In Progress"
          ? "In Progress"
          : "Pending") as StepState,
      date: doneDate,
    },
    {
      title: "Document Handover",
      text: "Submit required clearance documents and confirm asset handover.",
      state: handover,
      date: null,
    },
    {
      title: "Final Settlement",
      text: "Payroll computes final salary, leave encashment, and deductions.",
      state: (done ? "Completed" : "Pending") as StepState,
      date: doneDate,
    },
    {
      title: "Exit Complete",
      text: "Relieving documents and final closure confirmation are issued.",
      state: (done ? "Completed" : "Pending") as StepState,
      date: doneDate,
    },
  ];
}

function errorText(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

function EmployeeExit() {
  const contact = useMemo(() => getSupportContactConfig(), []);
  const telHref = `tel:${contact.phone.replace(/[^\d+]/g, "")}`;
  const [nowMs] = useState(() => Date.now());

  const [request, setRequest] = useState<ExitRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");

  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"email" | "phone" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingKey = useRef<string | null>(null);

  const loadRequest = useCallback(async () => {
    setError("");
    try {
      const data = await exitRequestService.listMine({ page: 1, limit: 1 });
      setRequest(data.items[0] ?? null);
    } catch (err) {
      setError(errorText(err, "Unable to load your exit request."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void exitRequestService
      .listMine({ page: 1, limit: 1 })
      .then((data) => {
        if (!active) return;
        setRequest(data.items[0] ?? null);
        setError("");
      })
      .catch((err) => {
        if (active) setError(errorText(err, "Unable to load your exit request."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!cancelConfirmOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !cancelling) {
        setCancelConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelConfirmOpen, cancelling]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRequest();
    setRefreshing(false);
  };

  const confirmCancel = async () => {
    if (!request || cancelling) return;

    setCancelling(true);
    setError("");

    try {
      setRequest(await exitRequestService.cancel(request.id));
      setCancelConfirmOpen(false);
      setSuccessNotice("Your resignation request has been cancelled.");
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
      setSuccessNotice(`Uploaded "${file.name}" successfully.`);
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

  const downloadAttachment = async (attachmentId: string, filename: string) => {
    if (!request) return;
    try {
      saveBlob(
        await exitRequestService.downloadMyAttachment(request.id, attachmentId),
        filename,
      );
    } catch (err) {
      setError(errorText(err, "Unable to download the attachment."));
    }
  };

  const copyContact = async (value: string, field: "email" | "phone") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => {
        setCopiedField((curr) => (curr === field ? null : curr));
      }, 2000);
    } catch {
      // Ignore clipboard API failure
    }
  };

  const step = request ? currentStep(request) : -1;
  const active = request ? isActive(request) : false;
  const showProgress = request ? active || request.status === "Completed" : false;
  const canStartNew =
    !request || request.status === "Rejected" || request.status === "Cancelled";

  const submittedDocsCount = request
    ? request.documents.filter((d) => d.status === "Submitted").length
    : 0;
  const totalDocsCount = request ? request.documents.length : 0;
  const pendingDocs = totalDocsCount - submittedDocsCount;

  const overviewItems = request && showProgress ? buildOverview(request) : [];
  const completedOverviewCount = overviewItems.filter(
    (item) => item.state === "Completed",
  ).length;
  const daysLeft = request ? daysRemaining(request.last_working_day, nowMs) : null;

  const contactHrCard = (spanClass: string, horizontal = false) => (
    <section
      className={`flex flex-col overflow-hidden rounded-[2px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${spanClass}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <Mail className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Contact HR
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Need help with exit or settlement?
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center p-5">
        <div
          className={`grid gap-3 ${
            horizontal ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1"
          }`}
        >
          <div className="flex items-center justify-between gap-2 rounded-[2px] border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
            <a
              href={`mailto:${contact.email}`}
              className="flex min-w-0 items-center gap-3"
            >
              <Mail className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Email
                </p>
                <p className="truncate text-[13px] font-medium text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400">
                  {contact.email}
                </p>
              </div>
            </a>
            <button
              type="button"
              onClick={() => void copyContact(contact.email, "email")}
              aria-label="Copy HR email"
              title="Copy email"
              className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            >
              {copiedField === "email" ? (
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-[2px] border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
            <a href={telHref} className="flex min-w-0 items-center gap-3">
              <Phone className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Phone
                </p>
                <p className="truncate text-[13px] font-medium text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400">
                  {contact.phone}
                </p>
              </div>
            </a>
            <button
              type="button"
              onClick={() => void copyContact(contact.phone, "phone")}
              aria-label="Copy HR phone"
              title="Copy phone"
              className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            >
              {copiedField === "phone" ? (
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 rounded-[2px] border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
            <Clock3 className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Working Hours
              </p>
              <p className="text-[13px] font-medium text-slate-900 dark:text-slate-100">
                {contact.workingHours}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div className="flex w-full flex-col gap-5 pb-10 text-sm">
      {/* Slim Page Header */}
      <PageHeading
        title="Manage your resignation request, clearance documents, and final settlement."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              leftIcon={
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
              }
            >
              Refresh
            </Button>
            {!loading && canStartNew && (
              <Link
                to="/employee/exit/resignation"
                className="inline-flex h-[30px] items-center gap-1.5 rounded-[6px] bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                {request ? "Start New Resignation" : "Start Resignation"}
              </Link>
            )}
          </>
        }
      />

      {/* Connected 4-Stage Offboarding Stepper */}
      <section className="rounded-[2px] border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:flex lg:items-center lg:justify-between lg:gap-0">
          {STEPPER.map((stage, i) => {
            const done = i < step || request?.status === "Completed";
            const current = i === step && request?.status !== "Completed";

            return (
              <li
                key={stage.label}
                className={`flex items-center gap-3 ${
                  i < STEPPER.length - 1 ? "lg:flex-1" : "shrink-0"
                }`}
              >
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition ${
                      done
                        ? "bg-emerald-600 text-white"
                        : current
                          ? "bg-blue-600 text-white ring-4 ring-blue-50 dark:ring-blue-950/60"
                          : "border border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`text-[13px] font-semibold ${
                        done
                          ? "text-emerald-700 dark:text-emerald-400"
                          : current
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {stage.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {stage.hint}
                    </p>
                  </div>
                </div>
                {i < STEPPER.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`mx-4 hidden h-0.5 flex-1 rounded-full lg:block ${
                      done
                        ? "bg-emerald-500"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Banners */}
      {successNotice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-[2px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{successNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotice("")}
            aria-label="Dismiss notice"
            className="rounded p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-[2px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
            className="rounded p-1 hover:bg-rose-100 dark:hover:bg-rose-900/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Row 1: My Resignation Request (8 cols) + Offboarding Summary (4 cols) */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-[2px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  My Resignation Request
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Current offboarding details and scheduled relieving timeline
                </p>
              </div>
            </div>

            {request && <ExitStatusBadge status={request.status} />}
          </div>

          <div className="flex flex-1 flex-col p-5">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-[2px]" />
                <Skeleton className="h-14 w-full rounded-[2px]" />
              </div>
            ) : !request ? (
              <div className="flex flex-1 flex-col items-start justify-between gap-4 rounded-[2px] border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/40 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    No resignation request submitted
                  </h3>
                  <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
                    If you are planning to leave the company, you can initiate a
                    resignation request and track clearance here.
                  </p>
                </div>
                <Link
                  to="/employee/exit/resignation"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                >
                  Start Resignation
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-4">
                <div className="grid grid-cols-2 gap-4 rounded-[2px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40 sm:grid-cols-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Request ID
                    </p>
                    <p className="mt-1 font-mono text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                      {request.request_number ?? request.id}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Requested Date
                    </p>
                    <p className="mt-1 text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatExitDate(request.submitted_at)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Last Working Day
                    </p>
                    <p className="mt-1 text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatExitDate(request.last_working_day)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Notice Period
                    </p>
                    <p className="mt-1 text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {request.notice_period_days} Days
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 rounded-[2px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Reason
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {request.reason}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Remarks
                    </p>
                    <p className="mt-1 text-[13px] text-slate-700 dark:text-slate-300">
                      {request.remarks?.trim() || "No additional remarks added"}
                    </p>
                  </div>
                </div>

                {request.status === "Rejected" && request.admin_note && (
                  <div className="rounded-[2px] border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/50 dark:bg-rose-950/30">
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                      HR Review Note
                    </p>
                    <p className="mt-1 text-[13px] text-rose-900 dark:text-rose-200">
                      {request.admin_note}
                    </p>
                  </div>
                )}

                {request.attachments.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Submitted Attachments
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {request.attachments.map((att) => (
                        <button
                          key={att.id}
                          type="button"
                          onClick={() =>
                            void downloadAttachment(att.id, att.file_name)
                          }
                          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-700"
                        >
                          <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          <span>{att.file_name}</span>
                          <span className="text-slate-400">
                            ({formatFileSize(att.file_size)})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {request.status === "Pending" && (
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3.5 dark:border-slate-800">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Pending HR review — you may withdraw this request before
                      approval.
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={cancelling}
                      onClick={() => setCancelConfirmOpen(true)}
                      className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
                    >
                      {cancelling ? "Cancelling…" : "Cancel Request"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Offboarding Summary */}
        <section className="flex flex-col overflow-hidden rounded-[2px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-4">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Offboarding Summary
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Timeline &amp; quick shortcuts
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col p-5">
            {request ? (
              <div className="flex flex-1 flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[2px] border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Relieving Countdown
                    </p>
                    <p className="mt-1 text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {daysLeft === null
                        ? "—"
                        : daysLeft > 0
                          ? `${daysLeft} days left`
                          : daysLeft === 0
                            ? "Today"
                            : "Completed"}
                    </p>
                  </div>

                  <div className="rounded-[2px] border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Documents
                    </p>
                    <p className="mt-1 text-base font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {submittedDocsCount}/{totalDocsCount} uploaded
                    </p>
                  </div>
                </div>

                {showProgress && overviewItems.length > 0 && (
                  <div className="rounded-[2px] border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        Exit Milestones
                      </span>
                      <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {completedOverviewCount}/{overviewItems.length} completed
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{
                          width: `${Math.round(
                            (completedOverviewCount / overviewItems.length) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-auto space-y-2 pt-1">
                  {request.attachments.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        void downloadAttachment(
                          request.attachments[0].id,
                          request.attachments[0].file_name,
                        )
                      }
                      className="flex w-full cursor-pointer items-center justify-between rounded-[2px] border border-slate-200 bg-white px-3.5 py-2.5 text-left text-[13px] font-medium text-blue-600 transition hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400 dark:hover:border-blue-700"
                    >
                      <span>Download Resignation Letter</span>
                      <Download className="h-4 w-4 shrink-0" />
                    </button>
                  )}

                  <Link
                    to="/employee/help"
                    className="flex w-full items-center justify-between rounded-[2px] border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <span>Need Settlement Help?</span>
                    <HelpCircle className="h-4 w-4 shrink-0" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col justify-between gap-3">
                <p className="text-[13px] text-slate-600 dark:text-slate-300">
                  Once you submit a resignation request, your relieving
                  countdown, document status, and clearance progress appear here.
                </p>
                <Link
                  to="/employee/help"
                  className="flex w-full items-center justify-between rounded-[2px] border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <span>Visit Help &amp; Support</span>
                  <HelpCircle className="h-4 w-4 shrink-0" />
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Inactive Notice */}
      {request && !showProgress && (
        <div className="rounded-[2px] border border-slate-200 bg-white px-5 py-4 text-[13px] text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          This request is{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {request.status.toLowerCase()}
          </span>
          , so there are no further offboarding tasks to complete.
        </div>
      )}

      {/* Row 2: Exit Process Overview (8 cols) + Documents to Submit (4 cols) */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        {request && showProgress && (
          <section className="flex min-w-0 flex-col overflow-hidden rounded-[2px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Exit Process Overview
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Track each offboarding milestone toward final completion
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {completedOverviewCount} of {overviewItems.length} completed
              </span>
            </div>

            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {overviewItems.map((item) => {
                const badge = PILL_STYLES[item.state];
                return (
                  <li
                    key={item.title}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {item.text}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.pill}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${badge.dot}`}
                        />
                        <span>{item.state}</span>
                      </span>
                      <span className="w-20 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {item.date ? formatExitDate(item.date) : "TBD"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section
          id="documents-section"
          className={`flex min-w-0 scroll-mt-6 flex-col overflow-hidden rounded-[2px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${
            request && showProgress ? "lg:col-span-4" : "lg:col-span-8"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                <Upload className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Documents to Submit
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Clearance &amp; handover forms
                </p>
              </div>
            </div>
            {request && active && pendingDocs > 0 && (
              <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800/60">
                {pendingDocs} Pending
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col p-5">
            {!request || !showProgress ? (
              <p className="text-[13px] text-slate-500 dark:text-slate-400">
                Required clearance documents appear here once you have an active
                resignation request.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {request.documents.map((doc) => (
                  <li
                    key={doc.key}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          doc.status === "Submitted"
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
                        }`}
                      >
                        {doc.status === "Submitted" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {doc.label}
                        </p>
                        {doc.status === "Submitted" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void downloadDocument(
                                doc.key,
                                doc.file_name ?? doc.label,
                              )
                            }
                            className="block max-w-full cursor-pointer truncate text-xs text-emerald-700 hover:underline dark:text-emerald-400"
                          >
                            Submitted · {doc.file_name}
                          </button>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {doc.required ? "Required" : "Optional"} · Pending
                            upload
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!active || uploadingKey === doc.key}
                      onClick={() => chooseFile(doc.key)}
                      leftIcon={<Upload className="h-3.5 w-3.5" />}
                    >
                      {uploadingKey === doc.key
                        ? "Uploading…"
                        : doc.status === "Submitted"
                          ? "Replace"
                          : "Upload"}
                    </Button>
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

        {(!request || !showProgress) && contactHrCard("lg:col-span-4")}
      </div>

      {/* Row 3: Knowledge & Task Handover (8 cols) + Contact HR (4 cols, or 12 cols if no handover tasks) */}
      {request && showProgress && (
        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
          {request.handover_tasks.length > 0 && (
            <section className="flex min-w-0 flex-col overflow-hidden rounded-[2px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                    <ClipboardCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Knowledge &amp; Task Handover
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Transition items recorded in your resignation request
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {request.handover_tasks.length} items
                </span>
              </div>

              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {request.handover_tasks.map((task) => {
                  const style = PILL_STYLES[task.status];
                  return (
                    <li
                      key={task.task}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {task.task}
                        </p>
                        {task.remarks && (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {task.remarks}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.pill}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                        />
                        {task.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {contactHrCard(
            request.handover_tasks.length > 0 ? "lg:col-span-4" : "lg:col-span-12",
            request.handover_tasks.length === 0,
          )}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !cancelling) {
              setCancelConfirmOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-exit-title"
            className="w-full max-w-md rounded-[2px] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/50">
                <LogOut className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>

              <div>
                <h3
                  id="cancel-exit-title"
                  className="text-base font-semibold text-slate-900 dark:text-slate-100"
                >
                  Cancel Resignation Request?
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Are you sure you want to cancel your resignation request? This
                  action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={cancelling}
                onClick={() => setCancelConfirmOpen(false)}
              >
                Keep Request
              </Button>

              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={cancelling}
                onClick={() => void confirmCancel()}
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel Request"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmployeeExit;
