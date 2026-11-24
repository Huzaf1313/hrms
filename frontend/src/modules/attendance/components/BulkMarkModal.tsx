import React, { useState } from "react";
import { Dialog } from "../../../components/ui/Dialog";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { useToast } from "../../../components/ui/useToast";
import { attendanceService } from "../attendanceService";
import { ApiError } from "../../../services/api";

export interface BulkMarkModalProps {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  selectedIds: string[];
  date: string;
  onSuccess: () => void;
}

export const BulkMarkModal: React.FC<BulkMarkModalProps> = ({
  open,
  onClose,
  selectedCount,
  selectedIds,
  date,
  onSuccess,
}) => {
  const { success, error } = useToast();
  const [status, setStatus] = useState("present");
  const [inTime, setInTime] = useState("09:30");
  const [outTime, setOutTime] = useState("18:30");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit() {
    setIsLoading(true);
    try {
      await attendanceService.bulkMark({
        employee_ids: selectedIds,
        date,
        status,
        in_time: inTime,
        out_time: outTime,
        notes: notes || "Bulk attendance marked by HR",
      });

      success(`Marked attendance for ${selectedCount} employee(s).`, "Bulk Mark Complete");
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to execute bulk mark.";
      error(msg, "Bulk Mark Failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Bulk Attendance Marking"
      description={`Apply attendance status to ${selectedCount} selected employee(s) for ${date}.`}
      maxWidth="md"
    >
      <div className="flex flex-col gap-4 text-xs">
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
          ]}
        />

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

        <Input
          label="Notes / Remarks"
          placeholder="e.g. Org-wide all-hands offsite"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} isLoading={isLoading}>
            Apply to {selectedCount} Records
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
