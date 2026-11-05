import { useState } from "react";
import { api } from "../../services/api";

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  in_time?: string | null;
  out_time?: string | null;
  check_in: string | null;
  check_out: string | null;
  status: string;
  total_hours: number | null;
  remarks: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface EmployeeAttendanceRegularizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceRecords: AttendanceRecord[];
}

function EmployeeAttendanceRegularizationModal({
  isOpen,
  onClose,
  attendanceRecords,
}: EmployeeAttendanceRegularizationModalProps) {
  const [selectedDate, setSelectedDate] = useState("");
  const [issueType, setIssueType] = useState("Missing Check-Out");
  const [requestedTime, setRequestedTime] = useState("");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (isSubmitting) return;

    setSelectedDate("");
    setIssueType("Missing Check-Out");
    setRequestedTime("");
    setReason("");
    setAttachment(null);
    setFormError(null);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const resolveCheckIn = (
    record: AttendanceRecord | null | undefined,
  ) => {
    if (!record) return null;
    return record.in_time ?? record.check_in ?? null;
  };

  const resolveCheckOut = (
    record: AttendanceRecord | null | undefined,
  ) => {
    if (!record) return null;
    return record.out_time ?? record.check_out ?? null;
  };

  const selectedAttendance = attendanceRecords.find(
    (record) => record.date === selectedDate,
  );

  const formatTime = (value: string | null) => {
    if (!value) {
      return "--:--";
    }

    const utcValue = value.endsWith("Z") ? value : `${value}Z`;

    return new Date(utcValue).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (value: string) => {
    if (!value) {
      return "--";
    }

    const date = new Date(`${value}T00:00:00`);

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      weekday: "long",
    });
  };

  // Determine which attendance dates should be available.
  const getSelectableDates = () => {
    const dates = new Set<string>();

    // Include dates with incomplete attendance records.
    attendanceRecords.forEach((record) => {
      const checkIn = resolveCheckIn(record);
      const checkOut = resolveCheckOut(record);

      if ((!checkIn && checkOut) || (checkIn && !checkOut)) {
        dates.add(record.date);
      }
    });

    // Include today even if no attendance document exists.
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(new Date());

    dates.add(today);

    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  };

  const selectableDates = getSelectableDates();

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setRequestedTime("");
    setFormError(null);

    const record = attendanceRecords.find(
      (item) => item.date === date,
    );

    if (!record) {
      // No attendance document means the employee is requesting
      // a missing check-in.
      setIssueType("Missing Check-In");
      return;
    }

    const checkIn = resolveCheckIn(record);
    const checkOut = resolveCheckOut(record);

    if (!checkIn && checkOut) {
      setIssueType("Missing Check-In");
    } else if (checkIn && !checkOut) {
      setIssueType("Missing Check-Out");
    } else {
      setIssueType("");
    }
  };

  const handleAttachmentChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      setFormError("Only JPG, PNG, and PDF files are allowed.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError("File size must be 5MB or less.");
      event.target.value = "";
      return;
    }

    setFormError(null);
    setAttachment(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!selectedDate) {
      setFormError("Please select an attendance date.");
      return;
    }

    if (!issueType) {
      setFormError("Please select an issue type.");
      return;
    }

    if (!requestedTime) {
      setFormError("Please provide the requested time.");
      return;
    }

    if (!reason.trim()) {
      setFormError("Please provide a reason for the request.");
      return;
    }

    if (reason.trim().length > 300) {
      setFormError("Reason cannot exceed 300 characters.");
      return;
    }

    // Missing Check-Out requires an existing attendance record.
    if (issueType === "Missing Check-Out" && !selectedAttendance) {
      setFormError(
        "An attendance record is required for a Missing Check-Out request.",
      );
      return;
    }

    // Prevent submitting an issue that does not match the record.
    if (selectedAttendance) {
      const checkIn = resolveCheckIn(selectedAttendance);
      const checkOut = resolveCheckOut(selectedAttendance);

      if (
        issueType === "Missing Check-In" &&
        (checkIn || !checkOut)
      ) {
        setFormError(
          "The selected attendance record is not eligible for a Missing Check-In request.",
        );
        return;
      }

      if (
        issueType === "Missing Check-Out" &&
        (!checkIn || checkOut)
      ) {
        setFormError(
          "The selected attendance record is not eligible for a Missing Check-Out request.",
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const requestData = {
        attendance_id: selectedAttendance?.id ?? null,
        date: selectedDate,
        issue_type: issueType,
        requested_check_in:
          issueType === "Missing Check-In"
            ? `${selectedDate}T${requestedTime}:00+05:30`
            : null,
        requested_check_out:
          issueType === "Missing Check-Out"
            ? `${selectedDate}T${requestedTime}:00+05:30`
            : null,
        reason: reason.trim(),
      };

      const response = await api.post(
        "/employee-attendance/regularization",
        requestData,
      );

      console.log("Regularization request submitted:", response);

      handleClose();
    } catch (error) {
      console.error("Regularization submission failed:", error);

      if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError(
          "Failed to submit regularization request. Please try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#17213a]">
              Regularization Request
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Request a correction for an attendance punch.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Select Date & Issue */}
          <section className="border-b border-gray-100 px-6 py-6">

            <h3 className="text-base font-bold text-[#17213a]">
              1. Select Date & Issue
            </h3>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">

              {/* Attendance Date */}
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Attendance Date <span className="text-red-500">*</span>
                </label>

                <select
                  value={selectedDate}
                  onChange={(event) =>
                    handleDateChange(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 outline-none transition focus:border-[#2563eb]"
                  required
                >
                  <option value="">Select attendance date</option>

                  {selectableDates.map((date) => (
                    <option key={date} value={date}>
                      {formatDate(date)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Issue Type */}
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Issue Type <span className="text-red-500">*</span>
                </label>

                <select
                  value={issueType}
                  onChange={(event) => {
                    setIssueType(event.target.value);
                    setRequestedTime("");
                    setFormError(null);
                  }}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 outline-none transition focus:border-[#2563eb] disabled:bg-gray-100"
                  required
                  disabled={!selectedDate}
                >
                  <option value="">Select issue type</option>

                  {selectedDate &&
                    (!selectedAttendance ||
                      (!resolveCheckIn(selectedAttendance) &&
                        resolveCheckOut(selectedAttendance))) && (
                      <option value="Missing Check-In">
                        Missing Check-In
                      </option>
                    )}

                  {selectedAttendance &&
                    resolveCheckIn(selectedAttendance) &&
                    !resolveCheckOut(selectedAttendance) && (
                      <option value="Missing Check-Out">
                        Missing Check-Out
                      </option>
                    )}
                </select>
              </div>
            </div>

            {/* Current Attendance */}
            <div className="mt-5 rounded-xl bg-[#f5f7fb] p-5">

              <p className="text-sm font-semibold text-gray-700">
                Current Attendance (as per system)
              </p>

              {!selectedDate ? (
                <p className="mt-3 text-sm text-gray-400">
                  Select an attendance date to view the current record.
                </p>
              ) : !selectedAttendance ? (
                <p className="mt-3 text-sm text-gray-500">
                  No attendance record exists for this date.
                  You can request a Missing Check-In correction.
                </p>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-3">

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Check-In
                    </p>

                    <p className="mt-1 text-base font-bold text-[#17213a]">
                      {formatTime(resolveCheckIn(selectedAttendance))}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Check-Out
                    </p>

                    <p className="mt-1 text-base font-bold text-[#17213a]">
                      {formatTime(resolveCheckOut(selectedAttendance))}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Status
                    </p>

                    <span className="mt-1 inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                      {selectedAttendance.status}
                    </span>
                  </div>

                </div>
              )}
            </div>
          </section>

          {/* Provide Correct Information */}
          <section className="px-6 py-6">

            <h3 className="text-base font-bold text-[#17213a]">
              2. Provide Correct Information
            </h3>

            {formError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-sm font-medium text-red-700">
                  {formError}
                </p>
              </div>
            )}

            {/* Requested Time */}
            <div className="mt-5">

              <label className="text-sm font-semibold text-gray-700">
                {issueType === "Missing Check-In"
                  ? "Requested Check-In Time"
                  : "Requested Check-Out Time"}{" "}
                <span className="text-red-500">*</span>
              </label>

              <input
                type="time"
                value={requestedTime}
                onChange={(event) =>
                  setRequestedTime(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-700 outline-none transition focus:border-[#2563eb] disabled:bg-gray-100"
                required
                disabled={!selectedDate || !issueType}
              />
            </div>

            {/* Reason */}
            <div className="mt-5">

              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">
                  Reason for Request{" "}
                  <span className="text-red-500">*</span>
                </label>

                <span className="text-xs text-gray-400">
                  {reason.length}/300
                </span>
              </div>

              <textarea
                value={reason}
                onChange={(event) => {
                  if (event.target.value.length <= 300) {
                    setReason(event.target.value);
                  }
                }}
                rows={4}
                placeholder="Explain why the attendance needs to be corrected."
                className="mt-2 w-full resize-none rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-700 outline-none transition focus:border-[#2563eb]"
                required
              />
            </div>

            {/* Attachment */}
            <div className="mt-5">

              <label className="text-sm font-semibold text-gray-700">
                Add Attachment{" "}
                <span className="font-normal text-gray-400">
                  (Optional)
                </span>
              </label>

              <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-[#fafbfc] px-6 py-8 text-center transition hover:border-[#2563eb] hover:bg-[#f8faff]">

                <p className="text-sm font-semibold text-gray-600">
                  {attachment
                    ? attachment.name
                    : "Drag & drop your file here or click to browse"}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  JPG, PNG, PDF up to 5MB
                </p>

                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleAttachmentChange}
                  className="hidden"
                />
              </label>
            </div>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-5">

            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Submitting..." : "➤ Submit Request"}
            </button>

          </div>
        </form>
      </div>
    </div>
  );
}

export default EmployeeAttendanceRegularizationModal;