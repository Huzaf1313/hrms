import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Clock, CheckCircle2, XCircle, Paperclip } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { StatusPill } from "../../../components/ui/Badge";
import { TableSkeleton } from "../../../components/ui/Skeleton";
import { EmptyState } from "../../../components/ui/EmptyState";
import {
  regularizationService,
  type RegularizationRequestItem,
  type RegularizationStatus,
} from "../services/regularizationService";

interface EmployeeRegularizationHistoryProps {
  employeeId: string;
  onRequestNew: () => void;
  className?: string;
}

export const EmployeeRegularizationHistory: React.FC<EmployeeRegularizationHistoryProps> = ({
  employeeId,
  onRequestNew,
  className = "",
}) => {
  const [requests, setRequests] = useState<RegularizationRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSampleData, setIsSampleData] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"All" | RegularizationStatus>("All");
  const [selectedRequest, setSelectedRequest] = useState<RegularizationRequestItem | null>(null);

  const fetchRequests = useCallback(() => {
    setIsLoading(true);
    regularizationService
      .getMyRequests(employeeId)
      .then((res) => {
        setRequests(res.requests);
        setIsSampleData(res.isSampleData);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [employeeId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRequests();
  }, [fetchRequests]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === "All") return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  const counts = useMemo(
    () => ({
      all: requests.length,
      Pending: requests.filter((r) => r.status === "Pending").length,
      Approved: requests.filter((r) => r.status === "Approved").length,
      Rejected: requests.filter((r) => r.status === "Rejected").length,
    }),
    [requests],
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toolbar row */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        {/* Left: Status Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["All", "Pending", "Approved", "Rejected"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors font-medium ${
                statusFilter === filter
                  ? "bg-slate-900 text-white font-semibold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {filter}
              <span className="ml-1.5 opacity-70">
                ({filter === "All" ? counts.all : counts[filter]})
              </span>
            </button>
          ))}
        </div>

        {/* Right: Sample data indicator & Request button */}
        <div className="flex items-center gap-2">
          {isSampleData && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Sample data
            </span>
          )}

          <Button
            variant="primary"
            size="xs"
            onClick={onRequestNew}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="h-8 text-xs font-medium"
          >
            New Request
          </Button>
        </div>
      </div>

      {/* Main List Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={5} columns={6} />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-12">
            <EmptyState
              title="No regularization requests"
              description={
                statusFilter === "All"
                  ? "You haven't submitted any attendance regularization requests yet."
                  : `No ${statusFilter.toLowerCase()} requests found.`
              }
              action={
                <Button variant="outline" size="sm" onClick={onRequestNew}>
                  Request Regularization
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Attendance Date</th>
                  <th className="py-2.5 px-3">Issue Type</th>
                  <th className="py-2.5 px-3">System Logged</th>
                  <th className="py-2.5 px-3">Requested Correction</th>
                  <th className="py-2.5 px-3">Reason / Remarks</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Requested On</th>
                  <th className="py-2.5 px-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-900 font-mono">
                      {req.displayDate}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">
                      {req.issueType}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {req.currentCheckIn ?? "--:--"} → {req.currentCheckOut ?? "--:--"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-blue-700 font-semibold">
                      {req.requestedCheckIn} → {req.requestedCheckOut}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                      <span title={req.reason}>{req.reason}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusPill
                        variant={req.status === "Approved" ? "success" : req.status === "Pending" ? "warning" : "danger"}
                        size="xs"
                      >
                        {req.status}
                      </StatusPill>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono">
                      {req.displayRequestedAt}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedRequest(req)}
                        className="text-blue-600 hover:text-blue-800 font-medium hover:underline text-xs"
                      >
                        View Timeline
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail & Status Timeline Drawer / Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-lg border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Regularization Request Details
                </h3>
                <span className="text-xs text-slate-400">
                  Ref: {selectedRequest.id} • {selectedRequest.displayDate}
                </span>
              </div>
              <StatusPill
                variant={selectedRequest.status === "Approved" ? "success" : selectedRequest.status === "Pending" ? "warning" : "danger"}
                size="xs"
              >
                {selectedRequest.status}
              </StatusPill>
            </div>

            {/* Side-by-side Punches */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50 text-xs">
              <div>
                <span className="text-xs text-slate-400 block font-medium">Original Logged Times</span>
                <span className="font-mono text-slate-600 mt-1 block">
                  {selectedRequest.currentCheckIn ?? "--:--"} - {selectedRequest.currentCheckOut ?? "--:--"}
                </span>
              </div>
              <div>
                <span className="text-xs text-blue-600 block font-semibold">Requested Correction</span>
                <span className="font-mono text-blue-700 font-semibold mt-1 block">
                  {selectedRequest.requestedCheckIn} - {selectedRequest.requestedCheckOut}
                </span>
              </div>
            </div>

            {/* Justification note */}
            <div>
              <span className="text-xs font-medium text-slate-700 block mb-1">
                Employee Justification
              </span>
              <p className="text-xs text-slate-600 p-2.5 rounded bg-slate-50 border border-slate-100 leading-relaxed">
                {selectedRequest.reason}
              </p>
            </div>

            {/* Attachment preview if present */}
            {selectedRequest.attachmentName && (
              <div className="flex items-center gap-2 p-2 rounded border border-slate-200 text-xs text-slate-700">
                <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate flex-1">{selectedRequest.attachmentName}</span>
                <span className="text-xs text-blue-600 font-medium">Attached Proof</span>
              </div>
            )}

            {/* Status Timeline */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-800 block mb-3">
                Approval Workflow Timeline
              </span>
              <div className="space-y-3 relative pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {/* Step 1: Submission */}
                <div className="relative text-xs">
                  <div className="absolute -left-4 top-0.5 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white" />
                  <span className="font-medium text-slate-900 block">Request Submitted</span>
                  <span className="text-xs text-slate-400 block">
                    {selectedRequest.displayRequestedAt} by Employee
                  </span>
                </div>

                {/* Step 2: Review */}
                <div className="relative text-xs">
                  <div
                    className={`absolute -left-4 top-0.5 w-3 h-3 rounded-full ring-4 ring-white ${
                      selectedRequest.status === "Approved"
                        ? "bg-emerald-600"
                        : selectedRequest.status === "Rejected"
                        ? "bg-rose-600"
                        : "bg-amber-500"
                    }`}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-900">
                      {selectedRequest.status === "Approved"
                        ? "Approved by Manager / HR"
                        : selectedRequest.status === "Rejected"
                        ? "Rejected by Manager / HR"
                        : "Pending Manager Review"}
                    </span>
                    {selectedRequest.status === "Approved" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                    )}
                    {selectedRequest.status === "Rejected" && (
                      <XCircle className="w-3.5 h-3.5 text-rose-600 inline" />
                    )}
                    {selectedRequest.status === "Pending" && (
                      <Clock className="w-3.5 h-3.5 text-amber-500 inline" />
                    )}
                  </div>
                  {selectedRequest.reviewedBy && (
                    <span className="text-xs text-slate-400 block">
                      {selectedRequest.reviewedBy} • {selectedRequest.reviewedAt}
                    </span>
                  )}
                  {selectedRequest.reviewerComment && (
                    <p className="mt-1.5 p-2 rounded bg-slate-100 text-xs text-slate-700 italic border-l-2 border-slate-400">
                      "{selectedRequest.reviewerComment}"
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setSelectedRequest(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
