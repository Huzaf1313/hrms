import React, { useState } from "react";
import { UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
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
  onSuccess?: () => void;
}

export const EmployeeAttendanceRegularizationModal: React.FC<EmployeeAttendanceRegularizationModalProps> = ({
  isOpen,
  onClose,
  attendanceRecords,
  onSuccess,
}) => {
  const { success, error } = useToast();

  const [selectedDate, setSelectedDate] = useState("");
  const [issueType, setIssueType] = useState("Missing Check-Out");
  const [requestedInTime, setRequestedInTime] = useState("");
  const [requestedOutTime, setRequestedOutTime] = useState("");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setFormError(null);

    const rec = attendanceRecords.find((r) => r.date === date);
    if (!rec) {
      setIssueType("Missing Check-In");
      return;
    }

    const hasIn = Boolean(rec.in_time || rec.check_in);
    const hasOut = Boolean(rec.out_time || rec.check_out);

    if (!hasIn && hasOut) {
      setIssueType("Missing Check-In");
    } else if (hasIn && !hasOut) {
      setIssueType("Missing Check-Out");
    } else {
      setIssueType("Incorrect In/Out Timings");
    }
  };

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
          <div className="flex items-center gap-2 p-2.5 rounded-md border border-rose-200 bg-rose-50 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Section 1: Date & Issue */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Attendance Date <span className="text-rose-500">*</span>
            </label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
              className="text-xs h-9"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Issue Classification <span className="text-rose-500">*</span>
            </label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-blue-600"
              required
            >
              <option value="Missing Check-In">Missing Punch-In</option>
              <option value="Missing Check-Out">Missing Punch-Out</option>
              <option value="Incorrect In/Out Timings">Incorrect In/Out Timings</option>
              <option value="Biometric / Technical Glitch">Biometric / Technical Glitch</option>
              <option value="On-Duty / Client Visit">On-Duty / Client Visit</option>
            </select>
          </div>
        </div>

        {/* System Attendance Snapshot */}
        {selectedDate && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
            <span className="font-semibold text-slate-700 block mb-1.5">
              System Logged Record ({formatDisplayDate(selectedDate)})
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-xs text-slate-400 block">Logged In Time</span>
                <span className="font-mono font-medium text-slate-800">
                  {resolveCheckIn(selectedAttendance)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Logged Out Time</span>
                <span className="font-mono font-medium text-slate-800">
                  {resolveCheckOut(selectedAttendance)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Current Status</span>
                <span className="font-medium text-slate-800">
                  {selectedAttendance?.status ?? "No Record"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Corrected Punches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Corrected Punch-In Time
            </label>
            <Input
              type="time"
              value={requestedInTime}
              onChange={(e) => setRequestedInTime(e.target.value)}
              className="text-xs h-9 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Corrected Punch-Out Time
            </label>
            <Input
              type="time"
              value={requestedOutTime}
              onChange={(e) => setRequestedOutTime(e.target.value)}
              className="text-xs h-9 font-mono"
            />
          </div>
        </div>

        {/* Section 3: Reason / Remarks */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-700">
              Justification / Reason <span className="text-rose-500">*</span>
            </label>
            <span className="text-xs text-slate-400">{reason.length}/300</span>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 300))}
            rows={3}
            placeholder="Detail why the punch is missing or incorrect (e.g. client meeting, biometric malfunction)..."
            className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 resize-none"
            required
          />
        </div>

        {/* Section 4: Optional Supporting Document */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Supporting Document <span className="text-slate-400 font-normal">(Optional, max 5MB)</span>
          </label>
          <div className="relative border border-dashed border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors bg-white flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <UploadCloud className="w-4 h-4 text-slate-400" />
              <span>{attachment ? attachment.name : "Attach proof (slip, client email, travel ticket)"}</span>
            </div>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {attachment && (
              <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Attached
              </span>
            )}
          </div>
        </div>

        {/* Dialog Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" type="button" onClick={handleClose} disabled={isSubmitting}>
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
