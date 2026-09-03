import { useEffect, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "../../services/api";

type RequestStatus = "Pending" | "Approved" | "Rejected";

interface RegularizationRequest {
  id: string;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  date: string;
  issue_type: string;
  requested_at: string;
  requested_check_in?: string;
  requested_check_out?: string;
  status: RequestStatus;
  reason: string;
  current_check_in?: string;
  current_check_out?: string;
  review_comment?: string;
}

const statusStyles: Record<RequestStatus, string> = {
  Pending: "bg-orange-50 text-orange-600",
  Approved: "bg-emerald-50 text-emerald-600",
  Rejected: "bg-rose-50 text-rose-600",
};

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function formatTime(value?: string): string {
  if (!value) return "--:--";

  const text = value.trim();
  if (/^\d{1,2}:\d{2}\s*[AP]M$/i.test(text)) return text;

  const date = new Date(text);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
}

function AdminRegularizationRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<RegularizationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<RegularizationRequest | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    api
      .get<RegularizationRequest[]>("/employee-attendance/regularization", {
        page: 1,
        limit: 100,
      })
      .then(setRequests)
      .catch(() => setError("Unable to load regularization requests."))
      .finally(() => setIsLoading(false));
  }, []);

  function closeModal() {
    setSelectedRequest(null);
    setComment("");
  }

  async function reviewRequest(status: "Approved" | "Rejected") {
    if (!selectedRequest) return;

    try {
      await api.patch(
        `/employee-attendance/regularization/${selectedRequest.id}/review`,
        { status, comment: comment || undefined },
      );
      setRequests((current) =>
        current.map((request) =>
          request.id === selectedRequest.id ? { ...request, status } : request,
        ),
      );
      closeModal();
    } catch (reviewError) {
      setError(
        reviewError instanceof ApiError
          ? reviewError.message
          : "Unable to update this request.",
      );
    }
  }

  return (
    <div className="px-8 pb-10 pt-8">
      <button
        type="button"
        onClick={() => navigate("/dashboard")}
        className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#2563eb] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back 
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Regularization Requests</h1>
        <p className="mt-1 text-gray-500">Review all employee attendance correction requests.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <p className="p-6 text-sm text-gray-500">Loading requests...</p>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">{error}</p>
        ) : requests.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No regularization requests found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Employee</th>
                  <th className="px-6 py-4 font-semibold">Attendance Date</th>
                  <th className="px-6 py-4 font-semibold">Issue</th>
                  <th className="px-6 py-4 font-semibold">Requested Time</th>
                  <th className="px-6 py-4 font-semibold">Applied On</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((request) => (
                  <tr
                    key={request.id}
                    onClick={() => setSelectedRequest(request)}
                    className="cursor-pointer text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">
                        {request.employee_name || "Employee"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {request.employee_code || "-"}
                        {request.department_name ? ` · ${request.department_name}` : ""}
                      </p>
                    </td>
                    <td className="px-6 py-4">{formatDate(request.date)}</td>
                    <td className="px-6 py-4">{request.issue_type}</td>
                    <td className="px-6 py-4">
                      In: {formatTime(request.requested_check_in)}
                      <br />
                      Out: {formatTime(request.requested_check_out)}
                    </td>
                    <td className="px-6 py-4">{formatDate(request.requested_at)}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[request.status]}`}>
                        {request.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
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

            <div className="overflow-y-auto p-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">
                    {selectedRequest.employee_name || "Employee"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedRequest.employee_code || "-"}
                    {selectedRequest.department_name
                      ? ` · ${selectedRequest.department_name}`
                      : ""}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[selectedRequest.status]}`}>
                  {selectedRequest.status}
                </span>
              </div>

              <h3 className="mb-3 text-sm font-bold text-gray-900">Request Information</h3>
              <div className="mb-5 space-y-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Attendance Date</span>
                  <span className="font-medium text-gray-800">{formatDate(selectedRequest.date)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">Issue Type</span>
                  <span className="font-medium text-gray-800">{selectedRequest.issue_type}</span>
                </div>
                <div>
                  <span className="text-gray-500">Reason</span>
                  <p className="mt-1 font-medium text-gray-800">{selectedRequest.reason}</p>
                </div>
              </div>

              <div className="mb-5 rounded-xl bg-gray-50 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Current Attendance (As per System)
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Check-In</p>
                    <p className="font-semibold text-emerald-600">{formatTime(selectedRequest.current_check_in)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Check-Out</p>
                    <p className="font-semibold text-rose-500">{formatTime(selectedRequest.current_check_out)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="mb-1 text-xs text-gray-500">Status</p>
                  <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                    {selectedRequest.issue_type}
                  </span>
                </div>
              </div>

              <div className="mb-5">
                <h3 className="mb-2 text-sm font-bold text-gray-900">Requested Change</h3>
                <p className="text-xs text-gray-500">Requested Check-In</p>
                <p className="text-sm font-semibold text-emerald-600">{formatTime(selectedRequest.requested_check_in)}</p>
                <p className="mt-3 text-xs text-gray-500">Requested Check-Out</p>
                <p className="text-sm font-semibold text-emerald-600">{formatTime(selectedRequest.requested_check_out)}</p>
              </div>

              {selectedRequest.status === "Pending" && (
                <div className="mt-5">
                  <label className="mb-1 block text-xs text-gray-500">
                    Add comments (optional)
                  </label>
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value.slice(0, 300))}
                    rows={3}
                    placeholder="Enter comments here..."
                    className="w-full resize-none rounded-lg border border-gray-200 p-3 text-sm focus:border-[#2563eb] focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 p-5">
              {selectedRequest.status === "Pending" ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
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
                <div className="space-y-3">
                  <div className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${statusStyles[selectedRequest.status]}`}>
                    {selectedRequest.status === "Approved" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    This request has been {selectedRequest.status.toLowerCase()}
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminRegularizationRequests;
