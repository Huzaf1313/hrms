import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, FileText, Check } from "lucide-react";
import { api, ApiError } from "../../services/api";

type RegularizationStatus = "Pending" | "Approved" | "Rejected";

interface RegularizationRequest {
  id: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  avatarUrl?: string;
  date: string;
  reason: string;
  requestedOn: string;
  status: RegularizationStatus;
  checkIn: string;
  checkOut: string;
  requestedCheckIn?: string;
  requestedCheckOut: string;
  attachmentName?: string;
  attachmentSize?: string;
  note: string;
}

const statusStyles: Record<RegularizationStatus, string> = {
  Pending: "bg-orange-50 text-orange-600",
  Approved: "bg-emerald-50 text-emerald-600",
  Rejected: "bg-rose-50 text-rose-600",
};


const mockRequests: RegularizationRequest[] = [
  {
    id: "1",
    employeeName: "Sneha Patil",
    employeeCode: "EMP004",
    department: "Engineering",
    date: "20 May 2024 (Mon)",
    reason: "Missing Check-Out",
    requestedOn: "Requested on 21 May 2024",
    status: "Pending",
    checkIn: "09:18 AM",
    checkOut: "--:--",
    requestedCheckOut: "06:30 PM",
    attachmentName: "Screenshot_24May2024.png",
    attachmentSize: "245 KB",
    note: "Forgot to punch out while leaving office after completing work.",
  },
  {
    id: "2",
    employeeName: "Sneha Patil",
    employeeCode: "EMP004",
    department: "Engineering",
    date: "14 May 2024 (Tue)",
    reason: "Wrong Check-In Time",
    requestedOn: "Requested on 15 May 2024",
    status: "Approved",
    checkIn: "11:45 AM",
    checkOut: "06:30 PM",
    requestedCheckOut: "09:20 AM",
    note: "Entered late by mistake, actual arrival was earlier.",
  },
  {
    id: "3",
    employeeName: "Sneha Patil",
    employeeCode: "EMP004",
    department: "Engineering",
    date: "8 May 2024 (Wed)",
    reason: "Missing Check-Out",
    requestedOn: "Requested on 9 May 2024",
    status: "Rejected",
    checkIn: "09:30 AM",
    checkOut: "--:--",
    requestedCheckOut: "06:45 PM",
    note: "Forgot to punch out.",
  },
];

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
  current_check_in?: string;
  current_check_out?: string;
}

function formatDate(value: string): string {
  const parsed = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value?: string): string {
  if (!value) return "--:--";

  const text = value.trim();
  if (/^\d{1,2}:\d{2}\s*[AP]M$/i.test(text)) return text;

  return new Date(text).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function mapRequest(request: BackendRequest): RegularizationRequest {
  return {
    id: request.id,
    employeeName: request.employee_name || request.employee_code || "Employee",
    employeeCode: request.employee_code || "-",
    department: request.department_name || "-",
    date: formatDate(request.date),
    reason: request.issue_type,
    requestedOn: `Requested on ${formatDate(request.requested_at)}`,
    status: request.status,
    checkIn: formatTime(request.current_check_in),
    checkOut: formatTime(request.current_check_out),
    requestedCheckIn: formatTime(request.requested_check_in),
    requestedCheckOut: formatTime(request.requested_check_out || request.requested_check_in),
    note: request.reason,
  };
}

function RegularizationRequestsCard({
  onReviewed,
}: {
  onReviewed?: () => void;
}) {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<RegularizationRequest[]>(mockRequests);
  const [selectedRequest, setSelectedRequest] = useState<RegularizationRequest | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    api.get<BackendRequest[]>("/employee-attendance/regularization")
      .then((data) => setRequests(data.map(mapRequest)))
      .catch(() => setRequests([]));
  }, []);

  async function reviewRequest(status: "Approved" | "Rejected") {
    if (!selectedRequest) return;

    try {
      await api.patch(`/employee-attendance/regularization/${selectedRequest.id}/review`, {
        status,
        comment: comment || undefined,
      });
      setRequests((current) => current.map((request) =>
        request.id === selectedRequest.id ? { ...request, status } : request,
      ));
      onReviewed?.();
      closeModal();
    } catch (error) {
      if (error instanceof ApiError) setComment(error.message);
    }
  }

  function closeModal() {
    setSelectedRequest(null);
    setComment("");
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h3 className="font-bold text-gray-900">Regularization Requests</h3>
        <button
          type="button"
          onClick={() => navigate("/dashboard/regularization")}
          className="text-xs font-semibold text-[#2563eb] hover:underline"
        >
          View All
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-gray-100 pr-1 [scrollbar-width:thin]">
        {requests.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">
            No regularization requests
          </div>
        ) : (
          requests.map((request) => (
            <button
              key={request.id}
              type="button"
              onClick={() => setSelectedRequest(request)}
              className="flex w-full items-start justify-between gap-2.5 py-2.5 text-left first:pt-0 last:pb-0 hover:bg-gray-50 rounded-lg px-1.5 -mx-1.5 transition"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-gray-900">{request.employeeName}</p>
                <p className="mt-0.5 text-xs font-medium text-gray-700">{request.date}</p>
                <p className="mt-0.5 truncate text-[11px] text-gray-500">{request.reason}</p>
                <p className="mt-0.5 text-[10px] text-gray-400">{request.requestedOn}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyles[request.status]}`}
              >
                {request.status}
              </span>
            </button>
          ))
        )}
      </div>


      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <h2 className="text-lg font-bold text-[#17213a]">Request Details</h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close request details"
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                    {selectedRequest.employeeName
                      .split(" ")
                      .map((part) => part[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedRequest.employeeName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedRequest.employeeCode} • {selectedRequest.department}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[selectedRequest.status]}`}
                >
                  {selectedRequest.status}
                </span>
              </div>

              <h3 className="mb-3 text-sm font-bold text-gray-900">Request Information</h3>
              <div className="mb-5 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Attendance Date</span>
                  <span className="font-medium text-gray-800">{selectedRequest.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Issue Type</span>
                  <span className="font-medium text-gray-800">{selectedRequest.reason}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Applied On</span>
                  <span className="font-medium text-gray-800">{selectedRequest.requestedOn.replace("Requested on ", "")}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="shrink-0 text-gray-500">Reason</span>
                  <span className="text-right font-medium text-gray-800">{selectedRequest.note}</span>
                </div>
              </div>

              <div className="mb-5 rounded-xl bg-gray-50 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Current Attendance (As per System)
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Check-In</p>
                    <p className="font-semibold text-emerald-600">{selectedRequest.checkIn}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Check-Out</p>
                    <p className="font-semibold text-rose-500">{selectedRequest.checkOut}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="mb-1 text-xs text-gray-500">Status</p>
                  <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                    {selectedRequest.reason}
                  </span>
                </div>
              </div>

              <div className="mb-5">
                <h3 className="mb-2 text-sm font-bold text-gray-900">Requested Change</h3>
                 <p className="text-xs text-gray-500">Requested Check-In</p>
                 <p className="text-sm font-semibold text-emerald-600">{selectedRequest.requestedCheckIn}</p>
                 <p className="mt-3 text-xs text-gray-500">Requested Check-Out</p>
                 <p className="text-sm font-semibold text-emerald-600">{selectedRequest.requestedCheckOut}</p>
              </div>

              {selectedRequest.attachmentName && (
                <div className="mb-5 border-t border-gray-100 pt-4">
                  <h3 className="mb-2 text-sm font-bold text-gray-900">Attachment</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{selectedRequest.attachmentName}</p>
                      <p className="text-xs text-gray-400">{selectedRequest.attachmentSize}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-4">
                <h3 className="mb-2 text-sm font-bold text-gray-900">Approval</h3>
                <label className="mb-1 block text-xs text-gray-500">Add comments (optional)</label>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value.slice(0, 300))}
                  placeholder="Enter comments here..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-200 p-3 text-sm focus:border-[#2563eb] focus:outline-none"
                />
                <p className="mt-1 text-right text-xs text-gray-400">{comment.length}/300</p>
              </div>
            </div>

                    {/* Footer actions */}
            <div className="border-t border-gray-100 p-5">
              {selectedRequest.status === "Pending" ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => reviewRequest("Rejected")}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewRequest("Approved")}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </button>
                </div>
              ) : (
                <div
                  className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${statusStyles[selectedRequest.status]}`}
                >
                  {selectedRequest.status === "Approved" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  This request has been {selectedRequest.status.toLowerCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RegularizationRequestsCard;
