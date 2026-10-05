import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  CalendarDays,
  Paperclip,
  Send,
  Upload,
  X,
} from "lucide-react";

import { countWorkingDays } from "../../utils/workingDays";

interface EmployeeLeaveModalProps {
  onClose: () => void;
  onSubmit: (
    leaveType: string,
    fromDate: string,
    toDate: string,
    reason: string,
    attachment: File | null,
  ) => Promise<void>;
  isSubmitting?: boolean;
}

const leaveTypes = [
  "Casual Leave",
  "Sick Leave",
  "Earned Leave",
  "Comp Off",
];

function getTodayDate() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function EmployeeLeaveModal({
  onClose,
  onSubmit,
  isSubmitting = false,
}: EmployeeLeaveModalProps) {
  const today = getTodayDate();

  const [leaveType, setLeaveType] = useState("Casual Leave");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [error, setError] = useState("");

  const totalDays = useMemo(() => {
    if (!fromDate || !toDate) {
      return 0;
    }

    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T00:00:00`);

    if (end < start) {
      return 0;
    }

    let workingDays = 0;
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();

      // Monday (1) to Friday (5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDays++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  }, [fromDate, toDate]);

  const formatDate = (date: string) => {
    if (!date) {
      return "";
    }

    const parsedDate = new Date(`${date}T00:00:00`);

    return parsedDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleAttachmentChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
    ];

    const maxSize = 5 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Only JPG, PNG, and PDF files are allowed.",
      );
      setAttachment(null);
      return;
    }

    if (file.size > maxSize) {
      setError(
        "Attachment size must be 5MB or less.",
      );
      setAttachment(null);
      return;
    }

    setError("");
    setAttachment(file);
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError("");

    if (!leaveType) {
      setError("Please select a leave type.");
      return;
    }

    if (!fromDate || !toDate) {
      setError(
        "Please select both from and to dates.",
      );
      return;
    }

    if (
      new Date(`${toDate}T00:00:00`) <
      new Date(`${fromDate}T00:00:00`)
    ) {
      setError(
        "To Date cannot be before From Date.",
      );
      return;
    }

    if (totalDays === 0) {
      setError(
        "The selected range falls only on Saturdays or Sundays. Please choose at least one working day.",
      );
      return;
    }

    if (!reason.trim()) {
      setError(
        "Please enter a reason for your leave.",
      );
      return;
    }

    if (reason.trim().length > 300) {
      setError(
        "Reason cannot exceed 300 characters.",
      );
      return;
    }

    try {
      await onSubmit(
        leaveType,
        fromDate,
        toDate,
        reason.trim(),
        attachment,
      );
    } catch {
      setError(
        "Unable to submit the leave request. Please try again.",
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSubmitting
        ) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Apply Leave
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Submit a new leave request for approval.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
            {/* Leave Type */}
            <div>
              <label
                htmlFor="leave-type"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Leave Type
                <span className="ml-1 text-red-500">*</span>
              </label>

              <select
                id="leave-type"
                value={leaveType}
                disabled={isSubmitting}
                onChange={(event) =>
                  setLeaveType(event.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                {leaveTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* From Date */}
              <div>
                <label
                  htmlFor="from-date"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  From Date
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <div className="relative">
                  <input
                    id="from-date"
                    type="date"
                    value={fromDate}
                    min={today}
                    disabled={isSubmitting}
                    onChange={(event) =>
                      setFromDate(event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />

                  <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>

                {fromDate && (
                  <p className="mt-1.5 text-xs text-slate-400">
                    {formatDate(fromDate)}
                  </p>
                )}
              </div>

              {/* To Date */}
              <div>
                <label
                  htmlFor="to-date"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  To Date
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <div className="relative">
                  <input
                    id="to-date"
                    type="date"
                    value={toDate}
                    min={fromDate || today}
                    disabled={isSubmitting}
                    onChange={(event) =>
                      setToDate(event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />

                  <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>

                {toDate && (
                  <p className="mt-1.5 text-xs text-slate-400">
                    {formatDate(toDate)}
                  </p>
                )}
              </div>
            </div>

            {/* Total Days */}
            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Total Days
                </span>

                <span className="text-base font-bold text-[#2563eb]">
                  {totalDays > 0
                    ? `${totalDays} ${
                        totalDays === 1
                          ? "Day"
                          : "Days"
                      }`
                    : "—"}
                </span>
              </div>

              <p className="mt-1.5 text-xs text-slate-500">
                {totalDays === 0
                  ? "Saturdays and Sundays are weekly offs. Pick at least one working day."
                  : "Excludes Saturdays and Sundays."}
              </p>
            </div>

            {/* Reason */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="leave-reason"
                  className="text-sm font-semibold text-slate-700"
                >
                  Reason
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <span
                  className={`text-xs ${
                    reason.length >= 300
                      ? "text-red-500"
                      : "text-slate-400"
                  }`}
                >
                  {reason.length}/300
                </span>
              </div>

              <textarea
                id="leave-reason"
                value={reason}
                maxLength={300}
                rows={4}
                disabled={isSubmitting}
                onChange={(event) =>
                  setReason(event.target.value)
                }
                placeholder="Enter the reason for your leave..."
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>

            {/* Attachment */}
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-1">
                <label className="text-sm font-semibold text-slate-700">
                  Add Attachment
                </label>

                <span className="text-xs font-normal text-slate-400">
                  (Optional)
                </span>
              </div>

              <label
                htmlFor="leave-attachment"
                className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-6 transition ${
                  isSubmitting
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:border-blue-400 hover:bg-blue-50/30"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                  <Upload className="h-5 w-5 text-[#2563eb]" />
                </div>

                {attachment ? (
                  <>
                    <p className="mt-3 text-sm font-medium text-slate-700">
                      {attachment.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Click to replace file
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-sm font-semibold text-[#2563eb]">
                      Upload file
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      JPG, PNG, PDF up to 5MB
                    </p>
                  </>
                )}

                <input
                  id="leave-attachment"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  disabled={isSubmitting}
                  className="hidden"
                  onChange={handleAttachmentChange}
                />
              </label>

              {attachment && (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <Paperclip className="h-3.5 w-3.5" />

                  <span>
                    {(
                      attachment.size /
                      1024 /
                      1024
                    ).toFixed(2)}{" "}
                    MB
                  </span>
                </div>
              )}

              <p className="mt-2 text-xs text-slate-400">
                Attachment upload will be connected to cloud storage separately.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmployeeLeaveModal;