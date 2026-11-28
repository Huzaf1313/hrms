import React, { useState, useMemo } from "react";
import { Check, X, AlertTriangle } from "lucide-react";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { StatusPill } from "../../../components/ui/Badge";
import { Dialog } from "../../../components/ui/Dialog";
import { getLeaveTypeMeta } from "../services/leaveTypes";
import type { LeaveRequest } from "../services/leaveService";
import type { MockTeamLeave } from "../../../services/mock/leaveMockService";

export interface LeaveApprovalsProps {
  requests: LeaveRequest[];
  teamLeaves?: MockTeamLeave[];
  isLoading?: boolean;
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string, comment: string) => Promise<void>;
  onBulkApprove?: (requestIds: string[]) => Promise<void>;
  className?: string;
}

function formatDays(count: number): string {
  const rounded = Math.round(count * 10) / 10;
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const clean = dateStr.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[monthIdx]} ${year}`;
}

function formatDateRange(startStr: string, endStr: string): string {
  if (!startStr) return "-";
  if (!endStr || startStr === endStr) return formatDate(startStr);
  const sParts = startStr.slice(0, 10).split("-");
  const eParts = endStr.slice(0, 10).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (sParts.length === 3 && eParts.length === 3) {
    const sDay = parseInt(sParts[2], 10);
    const sMonth = months[parseInt(sParts[1], 10) - 1];
    const sYear = sParts[0];

    const eDay = parseInt(eParts[2], 10);
    const eMonth = months[parseInt(eParts[1], 10) - 1];
    const eYear = eParts[0];

    if (sYear === eYear) {
      return `${sDay} ${sMonth} - ${eDay} ${eMonth} ${sYear}`;
    }
    return `${sDay} ${sMonth} ${sYear} - ${eDay} ${eMonth} ${eYear}`;
  }
  return `${startStr} - ${endStr}`;
}

export const LeaveApprovals: React.FC<LeaveApprovalsProps> = ({
  requests,
  teamLeaves = [],
  isLoading = false,
  onApprove,
  onReject,
  onBulkApprove,
  className = "",
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectingRequest, setRejectingRequest] = useState<LeaveRequest | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const pendingRequests = useMemo(() => {
    return requests.filter((r) => r.status.toLowerCase() === "pending");
  }, [requests]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRequests.map((r) => r.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0 || !onBulkApprove) return;
    setIsSubmitting(true);
    try {
      await onBulkApprove(Array.from(selectedIds));
      setSelectedIds(new Set());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingRequest || rejectComment.trim().length === 0) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await onReject(rejectingRequest.id, rejectComment.trim());
      setRejectingRequest(null);
      setRejectComment("");
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to record rejection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find overlapping colleagues for a given request
  const getOverlaps = (req: LeaveRequest) => {
    return teamLeaves.filter((l) => {
      if (l.employee_id === req.employee_id) return false;
      return req.start_date <= l.end_date && req.end_date >= l.start_date;
    });
  };

  return (
    <div className={`rounded-[2px] border border-[#E5E7EB] bg-white overflow-hidden shadow-none ${className}`}>
      {/* Header Toolbar inside the card */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3.5 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold text-[#111827]">Pending Leave Approvals</h3>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
            {pendingRequests.length}
          </span>
        </div>

        {selectedIds.size > 0 && onBulkApprove && (
          <Button
            variant="primary"
            onClick={handleBulkApprove}
            isLoading={isSubmitting}
            className="h-8 px-3.5 py-0 text-xs font-medium gap-2 shrink-0"
          >
            Bulk Approve ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="py-10 px-4 text-center text-xs text-[#6B7280]">
          Loading pending leave requests...
        </div>
      ) : pendingRequests.length === 0 ? (
        <div className="py-10 px-4 text-center text-xs text-[#6B7280]">
          No pending leave applications requiring approval.
        </div>
      ) : (
      <div className="overflow-x-auto w-full">
        <table className="min-w-[960px] w-full border-collapse text-left text-[12px]">
          <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#4B5563] font-semibold text-[11px] uppercase tracking-wider">
            <tr className="h-10">
              <th style={{ width: "48px" }} className="w-[48px] min-w-[48px] px-6 py-0 bg-[#F9FAFB] text-center align-middle font-semibold">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={pendingRequests.length > 0 && selectedIds.size === pendingRequests.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded text-[#2F5FD0] border-[#E5E7EB] focus:ring-[#2F5FD0] cursor-pointer"
                    aria-label="Select all pending requests"
                  />
                </div>
              </th>
              <th style={{ width: "240px" }} className="w-[240px] min-w-[240px] px-6 py-0 bg-[#F9FAFB] align-middle font-semibold">
                Employee
              </th>
              <th style={{ width: "160px" }} className="w-[160px] min-w-[160px] px-6 py-0 bg-[#F9FAFB] align-middle font-semibold">
                Leave Type
              </th>
              <th style={{ width: "220px" }} className="w-[220px] min-w-[220px] px-6 py-0 bg-[#F9FAFB] align-middle font-semibold">
                Duration
              </th>
              <th className="min-w-[280px] px-6 py-0 bg-[#F9FAFB] align-middle font-semibold">
                Reason & Team Impact
              </th>
              <th style={{ width: "180px" }} className="w-[180px] min-w-[180px] px-6 py-0 bg-[#F9FAFB] text-right align-middle font-semibold">
                Decision
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
            {pendingRequests.map((req) => {
                const meta = getLeaveTypeMeta(req.leave_type);
                const overlaps = getOverlaps(req);

                return (
                  <tr key={req.id} className="min-h-[56px] h-[56px] hover:bg-[#F9FAFB] transition-colors">
                    <td className="w-[48px] min-w-[48px] px-6 py-2 text-center align-middle">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(req.id)}
                          onChange={() => toggleSelect(req.id)}
                          className="h-4 w-4 rounded text-[#2F5FD0] border-[#E5E7EB] focus:ring-[#2F5FD0] cursor-pointer"
                        />
                      </div>
                    </td>

                    <td className="w-[240px] min-w-[240px] px-6 py-2 align-middle">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={req.employee_name || "Employee"} className="!w-8 !h-8 text-[11px] shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-[#111827] block truncate text-[12px] leading-tight">
                            {req.employee_name || req.employee_id}
                          </span>
                          <span className="text-[11px] text-[#6B7280] block mt-0.5 leading-tight">
                            {req.department_name ?? "General"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="w-[160px] min-w-[160px] px-6 py-2 align-middle">
                      <StatusPill variant={meta.badgeVariant} dot className="py-0.5 px-2.5 gap-1.5 h-5 text-[11px] leading-normal font-medium">
                        {req.leave_type}
                      </StatusPill>
                    </td>

                    <td className="w-[220px] min-w-[220px] px-6 py-2 align-middle">
                      <div>
                        <span className="text-[12px] font-medium text-[#111827] block leading-tight">
                          {formatDateRange(req.start_date, req.end_date)}
                        </span>
                        <span className="text-[11px] text-[#6B7280] block mt-0.5 leading-tight tabular-nums">
                          {formatDays(req.total_days ?? 1)}
                        </span>
                      </div>
                    </td>

                    <td className="min-w-[280px] px-6 py-2 align-middle">
                      <div className="max-w-md">
                        <span className="text-[12px] text-[#4B5563] block truncate" title={req.reason || ""}>
                          {req.reason || "-"}
                        </span>
                        {overlaps.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px] text-[#92400E] font-medium mt-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {overlaps.length} other team {overlaps.length === 1 ? "member" : "members"} on leave ({overlaps.map((o) => o.employee_name).join(", ")})
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="w-[180px] min-w-[180px] px-6 py-2 align-middle text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onApprove(req.id)}
                          className="h-7 px-2.5 py-0 text-[12px] font-medium gap-1 text-[#03543F] hover:bg-[#DEF7EC] border-[#BCF0DA]"
                          leftIcon={<Check className="w-3.5 h-3.5 shrink-0 text-[#03543F]" />}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRejectingRequest(req);
                            setRejectComment("");
                            setActionError(null);
                          }}
                          className="h-7 px-2.5 py-0 text-[12px] font-medium gap-1 text-[#9B1C1C] hover:bg-[#FDE8E8] border-[#F8B4B4]"
                          leftIcon={<X className="w-3.5 h-3.5 shrink-0 text-[#9B1C1C]" />}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      )}

      {/* Rejection Confirmation Modal (Comment is strictly required) */}
      <Dialog
        open={Boolean(rejectingRequest)}
        onClose={() => setRejectingRequest(null)}
        title="Reject Leave Application"
        description={
          rejectingRequest
            ? `Please provide a reason for rejecting the leave request of ${rejectingRequest.employee_name || rejectingRequest.employee_id} (${rejectingRequest.start_date} to ${rejectingRequest.end_date}).`
            : ""
        }
        maxWidth="md"
      >
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs font-medium text-[#1F2933] mb-1">
              Rejection Comment <span className="text-[#A12D22]">*</span>
            </label>
            <textarea
              rows={3}
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="State clear operational reason for rejection (e.g. critical project release deadline)..."
              className="w-full p-2.5 text-sm rounded-[6px] border border-[#E4E6E1] bg-white text-[#1F2933] placeholder:text-[#7B8794] focus:outline-none focus:border-[#2F5FD0]"
            />
          </div>

          {actionError && (
            <div className="p-2.5 rounded-[6px] bg-[#FBE4E1] text-[#A12D22] text-xs">
              {actionError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E4E6E1]">
            <Button variant="outline" size="sm" onClick={() => setRejectingRequest(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmReject}
              isLoading={isSubmitting}
              disabled={rejectComment.trim().length === 0}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default LeaveApprovals;
