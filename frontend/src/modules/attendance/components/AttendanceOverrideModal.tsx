import React, { useState } from "react";
import { Dialog } from "../../../components/ui/Dialog";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { useToast } from "../../../components/ui/useToast";
import { attendanceService } from "../attendanceService";
import type { AttendanceRecord } from "../types";

export interface AttendanceOverrideModalProps {
  open: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  onSuccess?: () => void;
}

export const AttendanceOverrideModal: React.FC<AttendanceOverrideModalProps> = ({
  open,
  onClose,
  record,
  onSuccess,
}) => {
  const { success, error } = useToast();
  const [inTime, setInTime] = useState(record?.in_time ?? "09:30");
  const [outTime, setOutTime] = useState(record?.out_time ?? "18:30");
  const [status, setStatus] = useState<string>(record?.status ?? "present");
  const [remarks, setRemarks] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!record) return null;

  async function handleSave() {
    if (!record) return;
    setIsLoading(true);
    try {
      await attendanceService.mark({
        employee_id: record.employee.id,
        date: record.date,
        status,
        in_time: inTime,
        out_time: outTime,
        notes: remarks || "Administrative override by HR",
      });

      success("Attendance adjusted successfully.", "Override Applied");
      if (onSuccess) onSuccess();
      onClose();
    } catch {
      error("Failed to update attendance override.", "Update Error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Attendance Override (Admin)"
      description={`Modify attendance record for ${record.employee.first_name} ${record.employee.last_name} (${record.employee.employee_code})`}
      maxWidth="md"
    >
      <div className="flex flex-col gap-4 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="In Time"
            type="time"
            value={inTime}
            onChange={(e) => setInTime(e.target.value)}
          />
          <Input
            label="Out Time"
            type="time"
            value={outTime}
            onChange={(e) => setOutTime(e.target.value)}
          />
        </div>

        <Select
          label="Attendance Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: "present", label: "Present" },
            { value: "late", label: "Late" },
            { value: "half_day", label: "Half Day" },
            { value: "on_leave", label: "On Leave" },
            { value: "absent", label: "Absent" },
            { value: "missing_punch", label: "Missing Punch" },
          ]}
        />

        <Input
          label="Reason for Override"
          placeholder="e.g. Biometric device failure at main lobby"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />

        <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} isLoading={isLoading}>
            Save Override
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
