import { useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  FileText,
  X,
} from "lucide-react";

type LeaveStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Cancelled";

interface LeaveRequest {
  id: string;
  dateApplied: string;
  leaveType: string;
  from: string;
  to: string;
  startDate?: string;
  endDate?: string;
  duration: number;
  status: LeaveStatus;
  reason: string;
  attachmentUrl: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNote: string | null;
}

interface EmployeeLeaveDetailsModalProps {
  request: LeaveRequest;
  onClose: () => void;
  onCancel: (request: LeaveRequest) => Promise<void>;
  isCancelling?: boolean;
}

function getStatusClasses(status: LeaveStatus) {
  switch (status) {
    case "Approved":
      return "bg-emerald-50 text-emerald-700 border border-emerald-100";

    case "Pending":
      return "bg-amber-50 text-amber-700 border border-amber-100";

    case "Rejected":
      return "bg-red-50 text-red-700 border border-red-100";

    case "Cancelled":
      return "bg-slate-100 text-slate-600 border border-slate-200";

    default:
      return "bg-slate-100 text-slate-600 border border-slate-200";
  }
}

function EmployeeLeaveDetailsModal({
  request,
  onClose,
  onCancel,
  isCancelling = false,
}: EmployeeLeaveDetailsModalProps) {
  const [showCancelConfirmation, setShowCancelConfirmation] =
    useState(false);

  const handleCancelClick = () => {
    if (isCancelling) {
      return;
    }

    setShowCancelConfirmation(true);
  };

  const handleConfirmCancel = async () => {
    if (isCancelling) {
      return;
    }

    await onCancel(request);
  };

  return (
    <>
      {/* Leave Details Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[2px]"
        onMouseDown={(event) => {
          if (
            event.target === event.currentTarget &&
            !isCancelling &&
            !showCancelConfirmation
          ) {
            onClose();
          }
        }}
      >
        <div className="w-full max-w-lg overflow-hidden rounded bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Leave Request Details
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                View the details of your leave request.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isCancelling}
              className="flex h-9 w-9 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {/* Leave type + status */}
            <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded bg-blue-50">
                  <CalendarDays className="h-5 w-5 text-[#2563eb]" />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Leave Type
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {request.leaveType}
                  </p>
                </div>
              </div>

              <span
                className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusClasses(
                  request.status,
                )}`}
              >
                {request.status}
              </span>
            </div>

            {/* Details grid */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-400">
                  Date Applied
                </p>

                <p className="mt-1.5 text-sm font-semibold text-slate-800">
                  {request.dateApplied}
                </p>
              </div>

              <div className="rounded border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-400">
                  Duration
                </p>

                <div className="mt-1.5 flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-slate-400" />

                  <p className="text-sm font-semibold text-slate-800">
                    {request.duration}{" "}
                    {request.duration === 1
                      ? "Day"
                      : "Days"}
                  </p>
                </div>
              </div>

              <div className="rounded border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-400">
                  From Date
                </p>

                <p className="mt-1.5 text-sm font-semibold text-slate-800">
                  {request.from}
                </p>
              </div>

              <div className="rounded border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-400">
                  To Date
                </p>

                <p className="mt-1.5 text-sm font-semibold text-slate-800">
                  {request.to}
                </p>
              </div>
            </div>

            {/* Reason */}
            <div className="mt-5 rounded border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />

                <p className="text-sm font-semibold text-slate-700">
                  Reason
                </p>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {request.reason || "No reason provided."}
              </p>
            </div>

            {/* Admin Note */}
            {request.adminNote && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">
                  Admin Note
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {request.adminNote}
                </p>
              </div>
            )}

            {/* Attachment */}
            {request.attachmentUrl && (
              <div className="mt-5 rounded-xl border border-slate-200 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">
                  Attachment
                </p>

                <a
                  href={request.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-[#2563eb] hover:text-blue-800"
                >
                  View Attachment
                </a>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-6 py-4">
            <div>
              {request.status === "Pending" && (
                <button
                  type="button"
                  onClick={handleCancelClick}
                  disabled={isCancelling}
                  className="inline-flex h-11 items-center justify-center rounded border border-red-200 bg-white px-5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel Leave
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isCancelling}
              className="inline-flex h-11 items-center justify-center rounded bg-[#2563eb] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded bg-white shadow-2xl">
            {/* Confirmation Content */}
            <div className="px-6 py-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-red-50">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Cancel Leave Request?
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Are you sure you want to cancel this leave request?
                    This action will change the request status to
                    <span className="font-semibold text-slate-700">
                      {" "}
                      Cancelled
                    </span>
                    .
                  </p>
                </div>
              </div>

              {/* Request Summary */}
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-400">
                      Leave Type
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {request.leaveType}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-400">
                      Duration
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {request.duration}{" "}
                      {request.duration === 1
                        ? "Day"
                        : "Days"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 border-t border-slate-200 pt-3">
                  <p className="text-xs font-medium text-slate-400">
                    Leave Dates
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {request.from} – {request.to}
                  </p>
                </div>
              </div>
            </div>

            {/* Confirmation Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/50 px-6 py-4">
              <button
                type="button"
                onClick={() =>
                  setShowCancelConfirmation(false)
                }
                disabled={isCancelling}
                className="inline-flex h-11 items-center justify-center rounded border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Keep Request
              </button>

              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="inline-flex h-11 items-center justify-center gap-2 rounded bg-red-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCancelling ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Cancelling...
                  </>
                ) : (
                  "Yes, Cancel Leave"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default EmployeeLeaveDetailsModal;
