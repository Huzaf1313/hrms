import React, { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useToast } from "../../components/ui/useToast";
import { regularizationService } from "./services/regularizationService";
import { ApiError } from "../../services/api";
import { formatDisplayDate } from "../../utils/dateKeys";

interface AttendanceRecordLike {
  id: string;
  date: string;
  in_time?: string | null;
  out_time?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  status: string;
}

interface EmployeeAttendanceRegularizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceRecords: AttendanceRecordLike[];
  initialDate?: string | null;
  onSuccess?: () => void;
}

const ISSUE_OPTIONS = [
  { value: "Missing Check-In", label: "Missing Punch-In" },
  { value: "Missing Check-Out", label: "Missing Punch-Out" },
  { value: "Incorrect In/Out Timings", label: "Incorrect In/Out Timings" },
  {
    value: "Biometric / Technical Glitch",
    label: "Biometric / Technical Glitch",
  },
  { value: "On-Duty / Client Visit", label: "On-Duty / Client Visit" },
];

const QUICK_REASONS = [
  "Forgot to punch out at shift end",
  "Client meeting / field visit",
  "Technical / portal login issue",
  "Missed morning punch-in",
];

function getLocalTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Converts "09:30 AM", "18:30", or ISO timestamp to "HH:mm" for <input type="time">. */
function toTimeInputValue(value?: string | null): string {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";

  const amPm = text.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (amPm) {
    let hrs = Number(amPm[1]);
    const mins = Number(amPm[2]);
    const period = amPm[3].toUpperCase();
    if (period === "PM" && hrs !== 12) hrs += 12;
    if (period === "AM" && hrs === 12) hrs = 0;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }

  const hhmm = text.match(/^(\d{1,2}):(\d{2})/);
  if (hhmm) {
    return `${String(Number(hhmm[1])).padStart(2, "0")}:${hhmm[2]}`;
  }

  if (text.includes("T")) {
    const hasTz = /(?:Z|[+-]\d{2}:\d{2})$/i.test(text);
    const parsed = new Date(hasTz ? text : `${text}Z`);
    if (!Number.isNaN(parsed.getTime())) {
      const ist = parsed.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      if (/^\d{2}:\d{2}/.test(ist)) return ist.slice(0, 5);
    }
  }

  return "";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function computeDurationLabel(inTime: string, outTime: string): string | null {
  if (!inTime || !outTime) return null;
  const [inH, inM] = inTime.split(":").map(Number);
  const [outH, outM] = outTime.split(":").map(Number);
  if (Number.isNaN(inH) || Number.isNaN(inM) || Number.isNaN(outH) || Number.isNaN(outM)) {
    return null;
  }
  const diffMinutes = outH * 60 + outM - (inH * 60 + inM);
  if (diffMinutes <= 0) return "Invalid";
  const hrs = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return `${hrs}h ${String(mins).padStart(2, "0")}m`;
}

function computeInitialFields(
  date: string | null | undefined,
  attendanceRecords: AttendanceRecordLike[],
): {
  selectedDate: string;
  issueType: string;
  requestedInTime: string;
  requestedOutTime: string;
} {
  const normalized = date ? date.slice(0, 10) : "";
  if (!normalized) {
    return {
      selectedDate: "",
      issueType: "Missing Check-Out",
      requestedInTime: "",
      requestedOutTime: "",
    };
  }

  const rec = attendanceRecords.find((r) => r.date === normalized);
  if (!rec) {
    return {
      selectedDate: normalized,
      issueType: "Missing Check-In",
      requestedInTime: "09:30",
      requestedOutTime: "18:30",
    };
  }

  const rawIn = rec.in_time || rec.check_in || null;
  const rawOut = rec.out_time || rec.check_out || null;
  const hasIn = Boolean(rawIn);
  const hasOut = Boolean(rawOut);

  if (!hasIn && hasOut) {
    return {
      selectedDate: normalized,
      issueType: "Missing Check-In",
      requestedInTime: "09:30",
      requestedOutTime: toTimeInputValue(rawOut),
    };
  }

  if (hasIn && !hasOut) {
    return {
      selectedDate: normalized,
      issueType: "Missing Check-Out",
      requestedInTime: toTimeInputValue(rawIn),
      requestedOutTime: "18:30",
    };
  }

  return {
    selectedDate: normalized,
    issueType: "Incorrect In/Out Timings",
    requestedInTime: toTimeInputValue(rawIn) || "09:30",
    requestedOutTime: toTimeInputValue(rawOut) || "18:30",
  };
}

export const EmployeeAttendanceRegularizationModal: React.FC<EmployeeAttendanceRegularizationModalProps> = ({
  isOpen,
  onClose,
  attendanceRecords,
  initialDate,
  onSuccess,
}) => {
  const { success, error } = useToast();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialFields = computeInitialFields(initialDate, attendanceRecords);

  const [selectedDate, setSelectedDate] = useState(initialFields.selectedDate);
  const [issueType, setIssueType] = useState(initialFields.issueType);
  const [requestedInTime, setRequestedInTime] = useState(initialFields.requestedInTime);
  const [requestedOutTime, setRequestedOutTime] = useState(initialFields.requestedOutTime);
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayKey = useMemo(() => getLocalTodayKey(), []);

  // Suggest up to 4 recent dates needing attention (missing punch, late, half_day, absent)
  const suggestedDates = useMemo(() => {
    const flagged = attendanceRecords
      .filter((r) => {
        const s = r.status?.toLowerCase();
        const hasIn = Boolean(r.in_time || r.check_in);
        const hasOut = Boolean(r.out_time || r.check_out);
        return (
          s === "missing_punch" ||
          s === "late" ||
          s === "half_day" ||
          s === "absent" ||
          (hasIn && !hasOut && r.date < todayKey)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4);

    return flagged;
  }, [attendanceRecords, todayKey]);

  const applyDateSelection = (date: string) => {
    const next = computeInitialFields(date, attendanceRecords);
    setSelectedDate(next.selectedDate);
    setIssueType(next.issueType);
    setRequestedInTime(next.requestedInTime);
    setRequestedOutTime(next.requestedOutTime);
    setFormError(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setSelectedDate("");
    setIssueType("Missing Check-Out");
    setRequestedInTime("");
    setRequestedOutTime("");
    setReason("");
    setAttachment(null);
    setFormError(null);
    onClose();
  };

  const selectedAttendance = attendanceRecords.find((r) => r.date === selectedDate);

  const resolveCheckIn = (r?: AttendanceRecordLike) => r?.in_time || r?.check_in || "--:--";
  const resolveCheckOut = (r?: AttendanceRecordLike) => r?.out_time || r?.check_out || "--:--";

  const durationLabel = computeDurationLabel(requestedInTime, requestedOutTime);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setFormError("Only JPG, PNG, and PDF files are allowed.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError("Attachment size must be 5MB or less.");
      e.target.value = "";
      return;
    }

    setFormError(null);
    setAttachment(file);
  };

  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedDate) {
      setFormError("Please select an attendance date.");
      return;
    }

    if (!issueType) {
      setFormError("Please select an issue type.");
      return;
    }

    if (!requestedInTime && !requestedOutTime) {
      setFormError("Please enter at least one corrected punch time (In or Out).");
      return;
    }

    if (durationLabel === "Invalid") {
      setFormError("Punch-Out time must be after Punch-In time.");
      return;
    }

    if (!reason.trim()) {
      setFormError("Please provide a justification for this request.");
      return;
    }

    setIsSubmitting(true);
    try {
      await regularizationService.submit({
        attendance_id: selectedAttendance?.id ?? null,
        date: selectedDate,
        issue_type: issueType,
        requested_check_in: requestedInTime ? `${selectedDate}T${requestedInTime}:00+05:30` : null,
        requested_check_out: requestedOutTime ? `${selectedDate}T${requestedOutTime}:00+05:30` : null,
        reason: reason.trim(),
      });

      success("Regularization request submitted for manager review.", "Request Submitted");
      handleClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to submit regularization request. Please try again.";
      setFormError(msg);
      error(msg, "Submission Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      title="Request Attendance Regularization"
      description="Submit an attendance correction request with justification for your reporting manager's approval."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Quick-Pick Flagged Dates */}
        {suggestedDates.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]">
              <Sparkles className="h-3.5 w-3.5 text-[#2563EB]" />
              Quick select recent dates needing attention
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedDates.map((rec) => {
                const isSelected = selectedDate === rec.date;
                const tag = rec.status.replace(/_/g, " ");
                return (
                  <button
                    key={rec.date}
                    type="button"
                    onClick={() => applyDateSelection(rec.date)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      isSelected
                        ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                        : "border-[#E5E7EB] bg-[#F9FAFB] text-[#374151] hover:border-[#D1D5DB] hover:bg-white"
                    }`}
                  >
                    <span>{formatDisplayDate(rec.date)}</span>
                    <span className="rounded bg-white px-1 py-0.5 text-[10px] capitalize text-[#6B7280]">
                      {tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 1: Date & Issue */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#374151]">
              Attendance Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                onChange={(e) => applyDateSelection(e.target.value)}
                max={todayKey}
                required
                className="h-9 pr-9 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  const el = dateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
                  el?.showPicker?.();
                  el?.focus();
                }}
                aria-label="Open date picker"
                className="absolute inset-y-0 right-0 flex items-center px-2.5 text-[#6B7280] hover:text-[#111827]"
              >
                <Calendar className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#374151]">
              Issue Classification <span className="text-rose-500">*</span>
            </label>
            <Select
              aria-label="Issue Classification"
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              options={ISSUE_OPTIONS}
              className="h-9 text-xs"
              required
            />
          </div>
        </div>

        {/* System Attendance Snapshot */}
        {selectedDate && (
          <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-xs">
            <span className="mb-2 block font-semibold text-[#111827]">
              System Logged Record ({formatDisplayDate(selectedDate)})
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="block text-[11px] text-[#6B7280]">Logged In</span>
                <span className="font-mono font-medium text-[#111827]">
                  {resolveCheckIn(selectedAttendance)}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-[#6B7280]">Logged Out</span>
                <span className="font-mono font-medium text-[#111827]">
                  {resolveCheckOut(selectedAttendance)}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-[#6B7280]">Status</span>
                <span className="font-medium capitalize text-[#111827]">
                  {selectedAttendance?.status?.replace(/_/g, " ") ?? "No Record"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Corrected Punches */}
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#374151]">
              <Clock className="h-3.5 w-3.5 text-[#6B7280]" />
              Corrected Timings
              {durationLabel && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    durationLabel === "Invalid"
                      ? "bg-rose-50 text-rose-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {durationLabel === "Invalid" ? "Check times" : `Duration: ${durationLabel}`}
                </span>
              )}
            </span>

            <button
              type="button"
              onClick={() => {
                setRequestedInTime("09:30");
                setRequestedOutTime("18:30");
                setFormError(null);
              }}
              className="text-[11px] font-medium text-[#2563EB] hover:text-[#1D4ED8]"
            >
              Use Shift (09:30 AM – 06:30 PM)
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#6B7280]">
                Corrected Punch-In Time
              </label>
              <Input
                type="time"
                value={requestedInTime}
                onChange={(e) => {
                  setRequestedInTime(e.target.value);
                  setFormError(null);
                }}
                className="h-9 font-mono text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#6B7280]">
                Corrected Punch-Out Time
              </label>
              <Input
                type="time"
                value={requestedOutTime}
                onChange={(e) => {
                  setRequestedOutTime(e.target.value);
                  setFormError(null);
                }}
                className="h-9 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Reason / Remarks */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-[#374151]">
              Justification / Reason <span className="text-rose-500">*</span>
            </label>
            <span className="text-[11px] text-[#6B7280]">{reason.length}/300</span>
          </div>

          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_REASONS.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => {
                  setReason(template);
                  setFormError(null);
                }}
                className={`rounded-md border px-2 py-1 text-[11px] transition ${
                  reason === template
                    ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8] font-medium"
                    : "border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563] hover:bg-white"
                }`}
              >
                {template}
              </button>
            ))}
          </div>

          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value.slice(0, 300));
              setFormError(null);
            }}
            rows={3}
            placeholder="Detail why the punch is missing or incorrect (e.g. client meeting, biometric malfunction)..."
            className="w-full resize-none rounded-lg border border-[#D1D5DB] p-2.5 text-xs text-[#111827] placeholder-[#9CA3AF] outline-none transition focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#DBEAFE]"
            required
          />
        </div>

        {/* Section 4: Optional Supporting Document */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[#374151]">
            Supporting Document{" "}
            <span className="font-normal text-[#6B7280]">(Optional, JPG/PNG/PDF, max 5MB)</span>
          </label>
          <div className="relative flex items-center justify-between gap-2 rounded-lg border border-dashed border-[#D1D5DB] bg-[#F9FAFB]/50 p-3 transition-colors hover:border-[#2563EB]/60 hover:bg-white">
            <div className="flex min-w-0 items-center gap-2 text-xs text-[#4B5563]">
              {attachment ? (
                <FileText className="h-4 w-4 shrink-0 text-[#2563EB]" />
              ) : (
                <UploadCloud className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
              )}
              <span className="truncate font-medium">
                {attachment
                  ? `${attachment.name} (${formatFileSize(attachment.size)})`
                  : "Attach proof (slip, client email, travel ticket)"}
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleFileChange}
              className="absolute inset-0 cursor-pointer opacity-0"
            />

            {attachment && (
              <div className="relative z-10 flex shrink-0 items-center gap-2">
                <span className="hidden items-center gap-1 text-[11px] font-medium text-emerald-600 sm:flex">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Attached
                </span>
                <button
                  type="button"
                  onClick={handleClearFile}
                  aria-label="Remove attached file"
                  title="Remove attachment"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[#6B7280] hover:bg-rose-50 hover:text-rose-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dialog Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] pt-3">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
            Submit Request
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

export default EmployeeAttendanceRegularizationModal;
