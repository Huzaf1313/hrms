import React, { useState, useMemo, useEffect } from "react";
import { Drawer } from "../../../components/ui/Drawer";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { useToast } from "../../../components/ui/useToast";
import {
  LEAVE_TYPE_CONFIG,
  getLeaveTypeMeta,
  calculateWorkingDaysWithHolidays,
  checkDateOverlap,
} from "../services/leaveTypes";
import { leaveService, type EmployeeLeaveBalance, type LeaveRequest } from "../services/leaveService";
import { UploadCloud, AlertTriangle } from "lucide-react";

export interface ApplyLeaveDrawerProps {
  open: boolean;
  onClose: () => void;
  balances: EmployeeLeaveBalance[];
  existingRequests?: LeaveRequest[];
  initialType?: string;
  onSuccess?: () => void;
}

export const ApplyLeaveDrawer: React.FC<ApplyLeaveDrawerProps> = ({
  open,
  onClose,
  balances,
  existingRequests = [],
  initialType,
  onSuccess,
}) => {
  const { success, error: showError } = useToast();

  const [leaveType, setLeaveType] = useState(initialType || "Casual Leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<"first_half" | "second_half">("first_half");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialType) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeaveType(initialType);
    }
  }, [initialType]);

  // Working days calculation excluding weekends and holidays
  const workingDaysCalc = useMemo(() => {
    if (!startDate || !endDate) return { days: 0, excludedWeekends: 0, excludedHolidays: 0 };
    return calculateWorkingDaysWithHolidays(startDate, endDate, isHalfDay);
  }, [startDate, endDate, isHalfDay]);

  // Balance calculation
  const selectedBalance = useMemo(() => {
    return balances.find((b) => b.leave_type === leaveType);
  }, [balances, leaveType]);

  const currentAvailable = selectedBalance?.available ?? 0;
  const balanceAfterApproval = currentAvailable - workingDaysCalc.days;

  // Overlap detection with user's own existing requests
  const hasOverlap = useMemo(() => {
    if (!startDate || !endDate) return false;
    return existingRequests.some((r) => {
      if (r.status.toLowerCase() === "rejected" || r.status.toLowerCase() === "cancelled") return false;
      return checkDateOverlap(startDate, endDate, r.start_date, r.end_date);
    });
  }, [startDate, endDate, existingRequests]);

  // Validation
  const validationError = useMemo(() => {
    if (startDate && endDate && endDate < startDate) {
      return "End date cannot be earlier than start date.";
    }
    if (hasOverlap) {
      return "You already have a leave request overlapping this date range.";
    }
    if (leaveType !== "Unpaid Leave" && workingDaysCalc.days > currentAvailable) {
      return `Insufficient leave balance. You have ${currentAvailable} days available, but requested ${workingDaysCalc.days} days.`;
    }
    if (startDate && endDate && workingDaysCalc.days === 0) {
      return "The selected dates fall completely on weekends or company holidays.";
    }
    if (reason.trim().length > 0 && reason.trim().length < 10) {
      return "Reason must be at least 10 characters long.";
    }
    return null;
  }, [startDate, endDate, hasOverlap, leaveType, workingDaysCalc.days, currentAvailable, reason]);

  const canSubmit =
    startDate &&
    endDate &&
    workingDaysCalc.days > 0 &&
    reason.trim().length >= 10 &&
    !validationError &&
    !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await leaveService.applyLeave({
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        is_half_day: isHalfDay,
        half_day_period: isHalfDay ? halfDayPeriod : undefined,
      });

      success(`Leave request for ${workingDaysCalc.days} days submitted successfully.`, "Request Filed");
      onSuccess?.();
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit leave request.";
      showError(msg, "Submission Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStartDate("");
    setEndDate("");
    setIsHalfDay(false);
    setReason("");
    setAttachment(null);
    onClose();
  };

  const meta = getLeaveTypeMeta(leaveType);

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title="Apply for Leave"
      description="Submit a formal leave application for manager approval"
      width="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={!canSubmit}
          >
            Submit Application
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm">
        {/* Leave Type Select with Accent Preview */}
        <div>
          <label className="block text-[12px] font-medium text-[#1F2933] mb-1">
            Leave Type <span className="text-[#A12D22]">*</span>
          </label>
          <div className="flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0"
              style={{ backgroundColor: meta.accent }}
            />
            <Select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="flex-1"
            >
              {Object.keys(LEAVE_TYPE_CONFIG).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>
          <span className="block text-xs text-[#7B8794] mt-1">
            {meta.description} • Available: <strong className="text-[#1F2933]">{currentAvailable} days</strong>
          </span>
        </div>

        {/* Date Range Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Start Date *"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (!endDate || endDate < e.target.value) {
                setEndDate(e.target.value);
              }
            }}
          />
          <Input
            label="End Date *"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Half Day Option */}
        <div className="p-3 rounded-[6px] bg-[#F6F7F5] border border-[#E4E6E1]">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-[#1F2933] block">Half Day Leave</span>
              <span className="text-xs text-[#7B8794]">Apply for morning or afternoon session only</span>
            </div>
            <input
              type="checkbox"
              id="half-day-toggle"
              checked={isHalfDay}
              onChange={(e) => setIsHalfDay(e.target.checked)}
              className="h-4 w-4 rounded text-[#2F5FD0] border-[#E4E6E1] focus:ring-[#2F5FD0]"
            />
          </div>

          {isHalfDay && (
            <div className="mt-3 pt-2.5 border-t border-[#E4E6E1] flex items-center gap-4 text-[12px]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="half-day-period"
                  checked={halfDayPeriod === "first_half"}
                  onChange={() => setHalfDayPeriod("first_half")}
                  className="text-[#2F5FD0]"
                />
                <span className="text-[#1F2933]">First Half (Morning)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="half-day-period"
                  checked={halfDayPeriod === "second_half"}
                  onChange={() => setHalfDayPeriod("second_half")}
                  className="text-[#2F5FD0]"
                />
                <span className="text-[#1F2933]">Second Half (Afternoon)</span>
              </label>
            </div>
          )}
        </div>

        {/* Working Days & Balance Calculation Preview */}
        {startDate && endDate && (
          <div className="p-3.5 rounded-[6px] bg-white border border-[#E4E6E1] text-[12px] space-y-2">
            <div className="flex items-center justify-between text-[#52606D]">
              <span>Working Days Count:</span>
              <span className="font-semibold text-[#1F2933]">{workingDaysCalc.days} days</span>
            </div>
            {(workingDaysCalc.excludedWeekends > 0 || workingDaysCalc.excludedHolidays > 0) && (
              <div className="text-xs text-[#7B8794] flex items-center gap-1">
                <span>(Excluded: {workingDaysCalc.excludedWeekends} weekend days, {workingDaysCalc.excludedHolidays} holidays)</span>
              </div>
            )}
            <div className="pt-2 border-t border-[#E4E6E1] flex items-center justify-between">
              <span className="text-[#52606D]">Balance After Approval:</span>
              <span
                className={`font-semibold ${
                  balanceAfterApproval < 0 ? "text-[#A12D22]" : "text-[#1E6B45]"
                }`}
              >
                {leaveType === "Unpaid Leave" ? "N/A (Unpaid)" : `${balanceAfterApproval} days`}
              </span>
            </div>
          </div>
        )}

        {/* Validation Warning Alert */}
        {validationError && (
          <div className="p-3 rounded-[6px] bg-[#FBE4E1] border border-[#F6C5C0] text-[#A12D22] text-[12px] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Reason Textarea (Required, min 10 chars) */}
        <div>
          <label className="block text-[12px] font-medium text-[#1F2933] mb-1">
            Reason for Absence <span className="text-[#A12D22]">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please detail the reason for your leave request (minimum 10 characters)..."
            className="w-full p-2.5 text-sm rounded-[6px] border border-[#E4E6E1] bg-white text-[#1F2933] placeholder:text-[#7B8794] focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] focus:border-[#2F5FD0]"
          />
          <div className="flex justify-between text-xs text-[#7B8794] mt-0.5">
            <span>Minimum 10 characters</span>
            <span>{reason.trim().length}/10</span>
          </div>
        </div>

        {/* Optional Document Attachment */}
        <div>
          <label className="block text-[12px] font-medium text-[#1F2933] mb-1">
            Supporting Document (Optional)
          </label>
          <div className="border border-dashed border-[#E4E6E1] rounded-[6px] p-3 text-center bg-[#F6F7F5]/50 hover:bg-[#F6F7F5] transition-colors cursor-pointer relative">
            <input
              type="file"
              onChange={(e) => setAttachment(e.target.files?.[0] || null)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-1">
              <UploadCloud className="w-5 h-5 text-[#7B8794]" />
              <span className="text-[12px] text-[#52606D]">
                {attachment ? attachment.name : "Click to attach medical certificate or travel memo"}
              </span>
              <span className="text-xs text-[#7B8794]">PDF, PNG, JPG up to 5MB</span>
            </div>
          </div>
        </div>
      </form>
    </Drawer>
  );
};

export default ApplyLeaveDrawer;
