import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, Clock, MessageSquare } from "lucide-react";
import { api, ApiError } from "../../services/api";
import { Avatar } from "../../components/ui/Avatar";
import { StatusPill } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../components/ui/useToast";
import { formatDisplayDate } from "../../utils/dateKeys";
import { canCurrentUser } from "../../lib/permissions";

export type RegularizationStatus = "Pending" | "Approved" | "Rejected";

export interface RegularizationRequest {
  id: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  date: string;
  reason: string;
  status: RegularizationStatus;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  note?: string;
}

interface BackendRequest {
  id: string;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  date: string;
  issue_type: string;
  reason: string;
  status: RegularizationStatus;
  requested_at: string;
  requested_check_in?: string;
  requested_check_out?: string;
}

const FALLBACK_REGULARIZATIONS: RegularizationRequest[] = [
  {
    id: "reg-1",
    employeeName: "Aiman Mulla",
    employeeCode: "AAR001",
    department: "Engineering",
    date: "2026-11-18",
    reason: "Missing Check-Out (Biometric Gate Offline)",
    status: "Pending",
    requestedCheckIn: "09:30 AM",
    requestedCheckOut: "06:30 PM",
    note: "Worked full shift; biometric reader failed at exit turnstile.",
  },
  {
    id: "reg-2",
    employeeName: "Shruti Ugale",
    employeeCode: "AAR003",
    department: "Engineering",
    date: "2026-11-17",
    reason: "Late Arrival (Pune Metro Line Disruption)",
    status: "Pending",
    requestedCheckIn: "09:30 AM",
    requestedCheckOut: "06:45 PM",
    note: "Metro train stalled between Garware & Civil Court for 40 mins.",
  },
];

export const RegularizationRequestsCard: React.FC<{ onReviewed?: () => void }> = ({
  onReviewed,
}) => {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const [requests, setRequests] = useState<RegularizationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Review Dialog state
  const [activeRequest, setActiveRequest] = useState<RegularizationRequest | null>(null);
  const [actionType, setActionType] = useState<"Approved" | "Rejected" | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canApprove = canCurrentUser("attendance:approve_regularization");

  useEffect(() => {
    let isMounted = true;
    api
      .get<BackendRequest[]>("/employee-attendance/regularization")
      .then((data) => {
        if (!isMounted) return;
        if (Array.isArray(data) && data.length > 0) {
          const mapped: RegularizationRequest[] = data.map((r) => ({
            id: r.id,
            employeeName: r.employee_name || r.employee_code || "Employee",
            employeeCode: r.employee_code || "--",
            department: r.department_name || "General",
            date: r.date,
            reason: r.issue_type || r.reason || "Missing Punch Correction",
            status: r.status,
            requestedCheckIn: r.requested_check_in,
            requestedCheckOut: r.requested_check_out,
            note: r.reason,
          }));
          setRequests(mapped);
        } else {
          setRequests(FALLBACK_REGULARIZATIONS);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setRequests(FALLBACK_REGULARIZATIONS);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function handleOpenDecision(request: RegularizationRequest, action: "Approved" | "Rejected") {
    setActiveRequest(request);
    setActionType(action);
    setReviewComment("");
  }

  async function handleConfirmDecision() {
    if (!activeRequest || !actionType || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await api.patch(`/employee-attendance/regularization/${activeRequest.id}/review`, {
        status: actionType,
        comment: reviewComment || undefined,
      });

      setRequests((prev) =>
        prev.map((r) => (r.id === activeRequest.id ? { ...r, status: actionType } : r)),
      );

      success(
        `Regularization request ${actionType.toLowerCase()} for ${activeRequest.employeeName}.`,
        "Request Processed",
      );

      if (onReviewed) onReviewed();
      setActiveRequest(null);
      setActionType(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to record decision.";
      error(msg, "Action Failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  const pendingRequests = requests.filter((r) => r.status === "Pending");

  // When there are 0 pending requests, collapse to a single slim row (about 48px)
  if (pendingRequests.length === 0 && !isLoading) {
    return (
      <div className="rounded-[6px] border border-[#E5E7EB] bg-white h-[48px] px-4 flex items-center justify-between shadow-none">
        <div className="flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-[#D97706]" />
          <h3 className="text-[14px] font-semibold text-[#111827]">
            Pending Regularization
          </h3>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280]">
            0
          </span>
          <span className="text-[12px] text-[#6B7280] hidden sm:inline ml-2">
            No pending requests
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/dashboard/regularization")}
          className="text-[13px] font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors cursor-pointer"
        >
          View all requests
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[6px] border border-[#E5E7EB] bg-white overflow-hidden shadow-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#D97706]" />
          <h3 className="text-[14px] font-semibold text-[#111827]">
            Pending Regularization
          </h3>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706]">
            {pendingRequests.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => navigate("/dashboard/regularization")}
          className="text-[13px] font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors cursor-pointer"
        >
          View all requests
        </button>
      </div>

      {/* List / Table Content */}
      <div className="divide-y divide-slate-100 overflow-x-auto">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-slate-400">Loading requests...</div>
        ) : pendingRequests.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            No pending regularization requests requiring review.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F9FAFB] text-[12px] font-semibold text-[#6B7280] normal-case tracking-normal border-b border-[#E5E7EB]">
              <tr>
                <th className="px-3.5 py-2 font-semibold">Employee</th>
                <th className="px-3.5 py-2 font-semibold">Date</th>
                <th className="px-3.5 py-2 font-semibold">Issue / Reason</th>
                <th className="px-3.5 py-2 font-semibold">Requested Time</th>
                <th className="px-3.5 py-2 font-semibold">Status</th>
                {canApprove && <th className="px-3.5 py-2 text-right font-semibold">Decision</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={req.employeeName} size="xs" />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900 block truncate leading-tight">
                          {req.employeeName}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {req.employeeCode} • {req.department}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-3.5 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                    {formatDisplayDate(req.date)}
                  </td>

                  <td className="px-3.5 py-2.5 text-slate-600 max-w-xs truncate" title={req.reason}>
                    {req.reason}
                  </td>

                  <td className="px-3.5 py-2.5 font-mono text-slate-700 whitespace-nowrap">
                    {req.requestedCheckIn || "--"} - {req.requestedCheckOut || "--"}
                  </td>

                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                    <StatusPill variant="warning">Pending</StatusPill>
                  </td>

                  {canApprove && (
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <Button
                          variant="outline"
                          size="xs"
                          className="text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 h-7 px-2"
                          onClick={() => handleOpenDecision(req, "Approved")}
                          leftIcon={<Check className="w-3 h-3 text-emerald-600" />}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="xs"
                          className="text-rose-700 hover:bg-rose-50 hover:border-rose-300 h-7 px-2"
                          onClick={() => handleOpenDecision(req, "Rejected")}
                          leftIcon={<X className="w-3 h-3 text-rose-600" />}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Decision Dialog Modal */}
      {activeRequest && actionType && (
        <Dialog
          open={Boolean(activeRequest)}
          onClose={() => {
            if (!isSubmitting) {
              setActiveRequest(null);
              setActionType(null);
            }
          }}
          title={`${actionType === "Approved" ? "Approve" : "Reject"} Regularization Request`}
          description={`Employee: ${activeRequest.employeeName} (${activeRequest.employeeCode}) • Date: ${formatDisplayDate(activeRequest.date)}`}
          maxWidth="sm"
        >
          <div className="flex flex-col gap-3 text-xs">
            <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Stated Reason</span>
              <p className="text-slate-800 mt-0.5">{activeRequest.reason}</p>
              {activeRequest.note && (
                <p className="text-slate-500 text-[11px] mt-1 italic">"{activeRequest.note}"</p>
              )}
            </div>

            <Input
              label={actionType === "Rejected" ? "Reason for Rejection *" : "Review Remarks (Optional)"}
              placeholder={actionType === "Rejected" ? "Please state why this request is rejected..." : "e.g. Verified with team lead"}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
            />

            <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveRequest(null);
                  setActionType(null);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant={actionType === "Approved" ? "primary" : "danger"}
                size="sm"
                onClick={handleConfirmDecision}
                isLoading={isSubmitting}
                disabled={actionType === "Rejected" && !reviewComment.trim()}
              >
                Confirm {actionType}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default RegularizationRequestsCard;
