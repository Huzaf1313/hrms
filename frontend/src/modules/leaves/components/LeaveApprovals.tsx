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
    <div className={`rounded-lg border border-[#E4E6E1] bg-white overflow-hidden shadow-none ${className}`}>
      {/* Header Toolbar inside the card */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E6E1]">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold text-[#1F2933]">Pending Leave Approvals</h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FBF0D9] text-[#8A5A00]">
            {pendingRequests.length}
          </span>
        </div>

        {selectedIds.size > 0 && onBulkApprove && (
          <Button
            variant="primary"
            onClick={handleBulkApprove}
            isLoading={isSubmitting}
            className="h-8 px-3.5 py-0 text-[13px] font-medium gap-2 shrink-0"
          >
            Bulk Approve ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto w-full">
        <table className="min-w-[960px] w-full border-collapse text-left text-sm">
          <thead className="bg-[#F6F7F5] border-b border-[#E4E6E1] text-[#7B8794] font-medium text-xs normal-case tracking-[0.02em]">
            <tr className="h-11">
              <th style={{ width: "48px" }} className="w-[48px] min-w-[48px] px-6 py-0 bg-[#F6F7F5] text-center align-middle font-medium">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={pendingRequests.length > 0 && selectedIds.size === pendingRequests.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded text-[#2F5FD0] border-[#E4E6E1] focus:ring-[#2F5FD0] cursor-pointer"
                    aria-label="Select all pending requests"
                  />
                </div>
              </th>
              <th style={{ width: "240px" }} className="w-[240px] min-w-[240px] px-6 py-0 bg-[#F6F7F5] align-middle font-medium">
                Employee
              </th>
              <th style={{ width: "160px" }} className="w-[160px] min-w-[160px] px-6 py-0 bg-[#F6F7F5] align-middle font-medium">
                Leave Type
              </th>
              <th style={{ width: "220px" }} className="w-[220px] min-w-[220px] px-6 py-0 bg-[#F6F7F5] align-middle font-medium">
                Duration
              </th>
              <th className="min-w-[280px] px-6 py-0 bg-[#F6F7F5] align-middle font-medium">
                Reason & Team Impact
              </th>
              <th style={{ width: "180px" }} className="w-[180px] min-w-[180px] px-6 py-0 bg-[#F6F7F5] text-right align-middle font-medium">
                Decision
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E6E1] bg-white text-[#1F2933]">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-[#7B8794]">
                  Loading pending leave requests...
                </td>
              </tr>
            ) : pendingRequests.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-[#7B8794]">
                  No pending leave applications requiring approval.
                </td>
              </tr>
            ) : (
              pendingRequests.map((req) => {
                const meta = getLeaveTypeMeta(req.leave_type);
                const overlaps = getOverlaps(req);

                return (
                  <tr key={req.id} className="min-h-[64px] h-[64px] hover:bg-[#FAFAF8] transition-colors">
                    <td className="w-[48px] min-w-[48px] px-6 py-3 text-center align-middle">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(req.id)}
                          onChange={() => toggleSelect(req.id)}
                          className="h-4 w-4 rounded text-[#2F5FD0] border-[#E4E6E1] focus:ring-[#2F5FD0] cursor-pointer"
                        />
                      </div>
                    </td>

                    <td className="w-[240px] min-w-[240px] px-6 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <Avatar name={req.employee_name || "Employee"} className="!w-9 !h-9 text-xs shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-[#1F2933] block truncate text-sm leading-tight">
                            {req.employee_name || req.employee_id}
                          </span>
                          <span className="text-xs text-[#7B8794] block mt-0.5 leading-tight">
                            {req.department_name ?? "General"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="w-[160px] min-w-[160px] px-6 py-3 align-middle">
                      <StatusPill variant={meta.badgeVariant} dot className="py-1 px-3 gap-1.5 h-auto text-xs leading-normal font-medium">
                        {req.leave_type}
                      </StatusPill>
                    </td>

                    <td className="w-[220px] min-w-[220px] px-6 py-3 align-middle font-mono">
                      <div>
                        <span className="text-[13px] font-mono text-[#1F2933] block leading-tight">
                          {req.start_date} to {req.end_date}
                        </span>
                        <span className="text-xs text-[#7B8794] block mt-0.5 leading-tight font-sans">
                          {req.total_days ?? 1} working {Number(req.total_days) === 1 ? "day" : "days"}
                        </span>
                      </div>
                    </td>

                    <td className="min-w-[280px] px-6 py-3 align-middle">
                      <div className="max-w-md">
                        <span className="text-sm text-[#52606D] block truncate" title={req.reason || ""}>
                          {req.reason || "-"}
                        </span>
                        {overlaps.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-[#8A5A00] font-medium mt-1">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>
                              {overlaps.length} other team {overlaps.length === 1 ? "member" : "members"} on leave ({overlaps.map((o) => o.employee_name).join(", ")})
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="w-[180px] min-w-[180px] px-6 py-3 align-middle text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onApprove(req.id)}
                          className="h-8 px-3.5 py-0 text-[13px] font-medium gap-1.5 text-[#1E6B45] hover:bg-[#E3F3EA] border-[#E4E6E1]"
                          leftIcon={<Check className="w-4 h-4 shrink-0 text-[#1E6B45]" />}
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
                          className="h-8 px-3.5 py-0 text-[13px] font-medium gap-1.5 text-[#A12D22] hover:bg-[#FBE4E1] border-[#E4E6E1]"
                          leftIcon={<X className="w-4 h-4 shrink-0 text-[#A12D22]" />}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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
