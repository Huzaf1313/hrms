import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, X, Search, Clock, Paperclip, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../../components/ui/Avatar";
import { StatusPill } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/useToast";
import {
  regularizationService,
  type RegularizationRequestItem,
} from "./services/regularizationService";
import { canCurrentUser } from "../../lib/permissions";

const statusFilters = ["All", "Pending", "Approved", "Rejected"] as const;

export const AdminRegularizationRequests: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const canApprove = canCurrentUser("attendance:approve_regularization");

  const [requests, setRequests] = useState<RegularizationRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSampleData, setIsSampleData] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("All");

  // Review modal state
  const [selectedRequest, setSelectedRequest] = useState<RegularizationRequestItem | null>(null);
  const [comment, setComment] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [actionType, setActionType] = useState<"Approved" | "Rejected" | null>(null);

  const loadRequests = useCallback(() => {
    setIsLoading(true);
    regularizationService
      .getAll()
      .then((res) => {
        setRequests(res.requests);
        setIsSampleData(res.isSampleData);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesStatus =
        statusFilter === "All" || request.status === statusFilter;

      const matchesQuery =
        query === "" ||
        request.employeeName.toLowerCase().includes(query) ||
        request.employeeCode.toLowerCase().includes(query) ||
        request.department.toLowerCase().includes(query) ||
        request.reason.toLowerCase().includes(query) ||
        request.issueType.toLowerCase().includes(query);

      return matchesStatus && matchesQuery;
    });
  }, [requests, search, statusFilter]);

  const counts = useMemo(
    () => ({
      all: requests.length,
      Pending: requests.filter((r) => r.status === "Pending").length,
      Approved: requests.filter((r) => r.status === "Approved").length,
      Rejected: requests.filter((r) => r.status === "Rejected").length,
    }),
    [requests],
  );

  function openReview(request: RegularizationRequestItem, action?: "Approved" | "Rejected") {
    setSelectedRequest(request);
    setActionType(action ?? null);
    setComment("");
  }

  function closeReview() {
    setSelectedRequest(null);
    setActionType(null);
    setComment("");
  }

  async function handleReview(status: "Approved" | "Rejected") {
    if (!selectedRequest) return;

    if (status === "Rejected" && !comment.trim()) {
      toastError("Please provide a rejection reason/comment.", "Comment Required");
      return;
    }

    setIsReviewing(true);
    try {
      await regularizationService.review(selectedRequest.id, status, comment.trim());

      setRequests((current) =>
        current.map((r) =>
          r.id === selectedRequest.id
            ? {
                ...r,
                status,
                reviewerComment: comment.trim() || undefined,
                reviewedBy: "You (Reviewer)",
                reviewedAt: "Just now",
              }
            : r,
        ),
      );

      success(`Request marked as ${status.toLowerCase()} successfully.`, `Request ${status}`);
      closeReview();
    } catch {
      toastError(`Failed to ${status.toLowerCase()} request. Please try again.`, "Review Failed");
    } finally {
      setIsReviewing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-5 max-w-7xl mx-auto w-full">
      {/* Page Header / Back navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard/attendance")}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors px-2 py-1 rounded border border-slate-200 bg-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Attendance
          </button>
          <p className="text-xs text-slate-500">
            Review and take action on employee attendance correction and punch regularization requests
          </p>
        </div>

        {isSampleData && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Sample data
          </span>
        )}
      </div>

      {/* Toolbar in ONE row */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        {/* Left: Search input */}
        <div className="relative min-w-[220px] max-w-xs flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, code, department..."
            className="h-8 pl-8 pr-2.5 text-xs rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-600 w-full"
          />
        </div>

        {/* Right: Status filter buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {statusFilters.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatusFilter(option)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors font-medium ${
                statusFilter === option
                  ? "bg-slate-900 text-white font-semibold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {option}
              <span className="ml-1.5 opacity-70">
                ({option === "All" ? counts.all : counts[option]})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Requests Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={8} columns={7} />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-12">
            <EmptyState
              title="No regularization requests"
              description={
                search || statusFilter !== "All"
                  ? "No requests match the current filters."
                  : "No attendance regularization requests found."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Attendance Date</th>
                  <th className="py-2.5 px-3">Issue Type</th>
                  <th className="py-2.5 px-3">System Logged vs Requested</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Requested On</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Employee */}
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <Avatar name={req.employeeName} size="xs" />
                        <div>
                          <span className="block font-medium">{req.employeeName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{req.employeeCode}</span>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-2.5 px-3 text-slate-600">{req.department}</td>

                    {/* Attendance Date */}
                    <td className="py-2.5 px-3 font-mono text-slate-800 font-medium">
                      {req.displayDate}
                    </td>

                    {/* Issue Type */}
                    <td className="py-2.5 px-3 text-slate-700">
                      <div>
                        <span className="font-medium block">{req.issueType}</span>
                        <span className="text-[10px] text-slate-400 truncate block max-w-xs" title={req.reason}>
                          {req.reason}
                        </span>
                      </div>
                    </td>

                    {/* Logged vs Requested */}
                    <td className="py-2.5 px-3 font-mono">
                      <span className="text-slate-400 line-through mr-1 text-[11px]">
                        {req.currentCheckIn ?? "--:--"} - {req.currentCheckOut ?? "--:--"}
                      </span>
                      <span className="text-blue-700 font-medium">
                        {req.requestedCheckIn} - {req.requestedCheckOut}
                      </span>
                    </td>

                    {/* Status Pill */}
                    <td className="py-2.5 px-3">
                      <StatusPill
                        variant={req.status === "Approved" ? "success" : req.status === "Pending" ? "warning" : "danger"}
                        size="xs"
                      >
                        {req.status}
                      </StatusPill>
                    </td>

                    {/* Requested On */}
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {req.displayRequestedAt}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => openReview(req)}
                          className="h-7 text-xs font-medium"
                        >
                          View
                        </Button>
                        {req.status === "Pending" && canApprove && (
                          <>
                            <button
                              type="button"
                              onClick={() => openReview(req, "Approved")}
                              title="Approve Request"
                              className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openReview(req, "Rejected")}
                              title="Reject Request"
                              className="p-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Dialog */}
      {selectedRequest && (
        <Dialog
          open={Boolean(selectedRequest)}
          onClose={closeReview}
          title={
            actionType === "Approved"
              ? "Approve Regularization Request"
              : actionType === "Rejected"
              ? "Reject Regularization Request"
              : "Regularization Request Details"
          }
          description={`Review attendance correction submitted by ${selectedRequest.employeeName} (${selectedRequest.employeeCode}).`}
          maxWidth="md"
        >
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <Avatar name={selectedRequest.employeeName} size="sm" />
                <div>
                  <span className="font-semibold text-slate-900 block text-xs">
                    {selectedRequest.employeeName}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {selectedRequest.employeeCode} • {selectedRequest.department}
                  </span>
                </div>
              </div>
              <StatusPill
                variant={selectedRequest.status === "Approved" ? "success" : selectedRequest.status === "Pending" ? "warning" : "danger"}
                size="xs"
              >
                {selectedRequest.status}
              </StatusPill>
            </div>

            {/* Side-by-side Punches */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-slate-200 bg-white text-xs">
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Original Logged Times</span>
                <span className="font-mono text-slate-600 mt-1 block font-medium">
                  {selectedRequest.currentCheckIn ?? "--:--"} → {selectedRequest.currentCheckOut ?? "--:--"}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Date: {selectedRequest.displayDate}</span>
              </div>
              <div>
                <span className="text-[11px] text-blue-600 block font-semibold">Requested Correction</span>
                <span className="font-mono text-blue-700 font-semibold mt-1 block">
                  {selectedRequest.requestedCheckIn} → {selectedRequest.requestedCheckOut}
                </span>
                <span className="text-[10px] text-blue-600 mt-0.5 block">Issue: {selectedRequest.issueType}</span>
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
                <span className="text-[10px] text-blue-600 font-medium">Attached Proof</span>
              </div>
            )}

            {/* Timeline */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-800 block mb-2">
                Workflow Status
              </span>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Requested on {selectedRequest.displayRequestedAt}</span>
              </div>
              {selectedRequest.reviewedBy && (
                <div className="mt-2 text-xs text-slate-600">
                  <span className="font-medium">Reviewed by:</span> {selectedRequest.reviewedBy}
                  {selectedRequest.reviewedAt && ` on ${selectedRequest.reviewedAt}`}
                  {selectedRequest.reviewerComment && (
                    <p className="mt-1 p-2 rounded bg-slate-100 text-[11px] text-slate-700 italic border-l-2 border-slate-400">
                      "{selectedRequest.reviewerComment}"
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Review Comment box if reviewing */}
            {selectedRequest.status === "Pending" && canApprove && (
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Manager Review Remarks {actionType === "Rejected" && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    actionType === "Rejected"
                      ? "Explain why this request is being rejected (mandatory)..."
                      : "Optional remarks or approval notes..."
                  }
                  rows={2}
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 resize-none"
                  required={actionType === "Rejected"}
                />
              </div>
            )}

            {/* Dialog Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={closeReview} disabled={isReviewing}>
                Cancel
              </Button>

              {selectedRequest.status === "Pending" && canApprove ? (
                <>
                  {actionType !== "Approved" && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleReview("Rejected")}
                      isLoading={isReviewing && actionType === "Rejected"}
                      leftIcon={<XCircle className="w-3.5 h-3.5" />}
                    >
                      Reject Request
                    </Button>
                  )}
                  {actionType !== "Rejected" && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleReview("Approved")}
                      isLoading={isReviewing && actionType === "Approved"}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      Approve Request
                    </Button>
                  )}
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={closeReview}>
                  Done
                </Button>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default AdminRegularizationRequests;
