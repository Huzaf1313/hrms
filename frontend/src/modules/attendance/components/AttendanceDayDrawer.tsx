import React from "react";
import { Drawer } from "../../../components/ui/Drawer";
import { StatusPill } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { FileEdit, CheckCircle2 } from "lucide-react";
import { formatDurationHours } from "../../../utils/dateKeys";
import type { EmployeeAttendanceRecord } from "../types";

export interface AttendanceDayDrawerProps {
  open: boolean;
  onClose: () => void;
  record: EmployeeAttendanceRecord | null;
  onRequestRegularization?: (record: EmployeeAttendanceRecord) => void;
}

export const AttendanceDayDrawer: React.FC<AttendanceDayDrawerProps> = ({
  open,
  onClose,
  record,
  onRequestRegularization,
}) => {
  if (!record) return null;

  const statusVariant =
    record.status === "present"
      ? "ok"
      : record.status === "late" || record.status === "half_day"
      ? "warn"
      : record.status === "on_leave"
      ? "leave"
      : record.status === "absent" || record.status === "missing_punch"
      ? "bad"
      : "off";

  const formattedDate = new Date(record.date).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isEligibleForRegularization =
    record.status === "missing_punch" ||
    record.status === "late" ||
    record.status === "half_day" ||
    record.status === "absent";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Attendance Details</span>
          <StatusPill variant={statusVariant}>{record.status.replace("_", " ").toUpperCase()}</StatusPill>
        </div>
      }
      description={formattedDate}
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          {isEligibleForRegularization && onRequestRegularization && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<FileEdit className="w-3.5 h-3.5" />}
              onClick={() => {
                onClose();
                onRequestRegularization(record);
              }}
            >
              Request Regularization
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5 text-xs text-slate-700">
        {/* Punch Summary Grid */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-[2px] bg-[#F6F7F5] border border-[#E4E6E1]">
          <div>
            <span className="text-[#7B8794] block text-xs uppercase font-medium">Punch In</span>
            <span className="text-sm font-semibold text-[#1F2933] mt-0.5 block">
              {record.status === "absent" ? "-" : (record.in_time || record.check_in || "-")}
            </span>
            {record.is_late && (
              <span className="text-xs text-[#8A5A00] font-medium mt-0.5 block">
                Late arrival ({record.late_minutes ?? 0}m)
              </span>
            )}
          </div>

          <div>
            <span className="text-[#7B8794] block text-xs uppercase font-medium">Punch Out</span>
            <span className="text-sm font-semibold text-[#1F2933] mt-0.5 block">
              {record.status === "absent" ? "-" : (record.out_time || record.check_out || "-")}
            </span>
          </div>

          <div className="pt-2 border-t border-[#E4E6E1]">
            <span className="text-[#7B8794] block text-xs uppercase font-medium">Total Duration</span>
            <span className="text-sm font-semibold text-[#1F2933] mt-0.5 block">
              {record.status === "absent" ? "-" : formatDurationHours(record.total_hours)}
            </span>
          </div>

          <div className="pt-2 border-t border-[#E4E6E1]">
            <span className="text-[#7B8794] block text-xs uppercase font-medium">Shift Assigned</span>
            <span className="text-sm font-semibold text-[#1F2933] mt-0.5 block capitalize">
              {record.shift || "General Shift"}
            </span>
          </div>
        </div>

        {/* Regularization status notice */}
        {record.is_regularized && (
          <div className="p-3 rounded-[2px] bg-blue-50 border border-blue-200 text-blue-800 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Regularization Approved</span>
              <span className="text-slate-600 text-xs mt-0.5 block">
                This attendance entry was corrected via approved regularization.
              </span>
            </div>
          </div>
        )}

        {/* Remarks and Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-800">Punch Remarks & Log</label>
          <div className="p-3 rounded-[2px] border border-slate-200 bg-white text-slate-600 leading-relaxed">
            {record.remarks || "No remarks logged for this working date."}
          </div>
        </div>

        {/* Shift Details */}
        <div className="space-y-2 border-t border-slate-100 pt-4">
          <label className="text-xs font-semibold text-slate-800">Shift Specification</label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-[2px] border border-slate-100 bg-slate-50/50">
              <span className="text-slate-400 text-xs block">Start Time</span>
              <span className="font-medium text-slate-800">{record.shift_start || "09:30 AM"}</span>
            </div>
            <div className="p-2.5 rounded-[2px] border border-slate-100 bg-slate-50/50">
              <span className="text-slate-400 text-xs block">End Time</span>
              <span className="font-medium text-slate-800">{record.shift_end || "06:30 PM"}</span>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
};
