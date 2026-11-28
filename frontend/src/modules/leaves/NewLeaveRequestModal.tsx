import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  CalendarDays,
  ChevronDown,
  ClipboardPlus,
  Paperclip,
  Send,
  Upload,
  X,
} from "lucide-react";

import { adminProfileService } from "../employees/adminProfileService";
import { leaveService } from "./admin_leave_service";
import { currentSessionUser } from "../../lib/session";
import type { AdminProfile } from "../employees/adminProfileTypes";
import { LEAVE_TYPES, type LeaveRequestDraft } from "./types";
import { countWorkingDays, parseDateOnly } from "../../utils/workingDays";

const MAX_REASON_LENGTH = 300;
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "application/pdf"];

const FIELD_CLASS =
  "h-11 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 " +
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

interface NewLeaveRequestModalProps {
  onClose: () => void;
  onSubmit: (draft: LeaveRequestDraft) => void | Promise<void>;
  isSubmitting?: boolean;
}

/**
 * The leave form an admin fills in for themselves.
 *
 * The applicant is whoever is signed in - there is no employee picker, so a
 * request can never be filed against somebody else's record. The identity is
 * read from the session the login page stored, with the cached admin profile
 * only as a fallback for a missing session.
 */
export default function NewLeaveRequestModal({
  onClose,
  onSubmit,
  isSubmitting = false,
}: NewLeaveRequestModalProps) {
  const today = todayAsInputValue();

  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [availableTypes, setAvailableTypes] = useState<string[]>([...LEAVE_TYPES]);
  const [leaveType, setLeaveType] = useState<string>(LEAVE_TYPES[0]);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const busy = isSubmitting || submitting;

  const session = useMemo(() => currentSessionUser(), []);

  const applicantName = session?.full_name?.trim() || profile?.full_name || "";
  // Admin-only accounts carry no employee code, so the account id stands in
  // for one rather than borrowing the seeded profile's code.
  const applicantEmployeeId =
    session?.employee_id?.trim() || session?.id?.trim() || profile?.employee_id || "";
  const applicantEmail = session?.email?.trim() || profile?.email || "";

  useEffect(() => {
    let active = true;

    adminProfileService
      .getProfile()
      .then((nextProfile) => {
        if (active) setProfile(nextProfile);
      })
      .catch(() => {
        if (active) {
          setProfile(null);
        }
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    leaveService
      .balances()
      .then((savedBalances) => {
        if (!active || !savedBalances?.length) return;
        const types = savedBalances.map((b) => b.leave_type);
        setAvailableTypes(types);
        setLeaveType((current) => (types.includes(current) ? current : types[0] || current));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const totalDays = useMemo(
    () => (fromDate && toDate ? countWorkingDays(fromDate, toDate) : 0),
    [fromDate, toDate],
  );

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!ATTACHMENT_TYPES.includes(file.type)) {
      setError("Only JPG, PNG and PDF files can be attached.");
      setAttachment(null);
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      setError("Attachment size must be 5MB or less.");
      setAttachment(null);
      return;
    }

    setError("");
    setAttachment(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    setError("");

    if (!applicantEmployeeId) {
      setError("Your profile is missing an employee ID. Please log in again.");
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
        employee_id: applicantEmployeeId,
        employee_name: applicantName || applicantEmail,
        department_name: profile?.department,
        leave_type: leaveType,
        start_date: fromDate,
        end_date: toDate,
        reason: reason.trim(),
        attachment_name: attachment?.name,
        attachment_size: attachment?.size,
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
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2px] bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded bg-blue-50">
              <ClipboardPlus className="h-5 w-5 text-[#2563eb]" />
            </span>

            <div>
              <h2 className="text-xl font-bold text-slate-900">Apply for Leave</h2>
              <p className="mt-1 text-sm text-slate-500">
                Submit your own leave request for approval.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-9 w-9 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* The signed-in applicant */}
            <div className="rounded-[2px] border border-blue-100 bg-blue-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Leave applicant</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <ProfileValue
                  label="Name"
                  value={applicantName || (loadingProfile ? "Loading..." : "Signed-in user")}
                />
                <ProfileValue label="Employee ID" value={applicantEmployeeId || "—"} />
                <ProfileValue label="Email" value={applicantEmail || "—"} />
              </div>
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
                  onChange={(event) => setLeaveType(event.target.value)}
                  className={SELECT_CLASS}
                >
                  {availableTypes.map((type) => (
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
                    min={today}
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
            <div className="rounded-[2px] border border-blue-100 bg-blue-50 px-4 py-3">
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
                className="w-full resize-none rounded border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>

            {/* Attachment */}
            <div>
              <div className="mb-2 flex items-center gap-1">
                <label htmlFor="leave-attachment" className="text-sm font-semibold text-slate-700">
                  Add Attachment
                </label>

                <span className="text-xs font-normal text-slate-400">(Optional)</span>
              </div>

              <label
                htmlFor="leave-attachment"
                className={`flex flex-col items-center justify-center rounded-[2px] border border-dashed border-slate-300 bg-slate-50/50 px-4 py-6 transition ${
                  busy ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-blue-400 hover:bg-blue-50/30"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                  <Upload className="h-5 w-5 text-[#2563eb]" />
                </div>

                {attachment ? (
                  <>
                    <p className="mt-3 text-sm font-medium text-slate-700">{attachment.name}</p>

                    <p className="mt-1 text-xs text-slate-400">Click to replace file</p>
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-sm font-semibold text-[#2563eb]">Upload file</p>

                    <p className="mt-1 text-xs text-slate-400">JPG, PNG, PDF up to 5MB</p>
                  </>
                )}

                <input
                  id="leave-attachment"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  disabled={busy}
                  className="hidden"
                  onChange={handleAttachmentChange}
                />
              </label>

              {attachment && (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <Paperclip className="h-3.5 w-3.5" />

                  <span>{(attachment.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              )}

              <p className="mt-2 text-xs text-slate-400">
                The document stays on this device. Uploading it to storage is wired up separately.
              </p>
            </div>

            {error && (
              <div role="alert" className="rounded-[2px] border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={busy || loadingProfile}
              className="inline-flex h-11 items-center justify-center rounded border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded bg-[#2563eb] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
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

function ProfileValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-blue-600">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
