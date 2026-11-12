import { currentSessionUser } from "../../lib/session";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Clock, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "../../services/api";
import { GlobalDateBadge } from "../../components/GlobalDateBadge";

type RegularizationStatus = "Pending" | "Approved" | "Rejected";

interface RegularizationRequest {
  id: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  date: string;
  reason: string;
  requestedOn: string;
  status: RegularizationStatus;
  checkIn: string;
  checkOut: string;
  requestedCheckIn?: string;
  requestedCheckOut: string;
  note: string;
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
  current_check_in?: string;
  current_check_out?: string;
}

const statusStyles: Record<RegularizationStatus, string> = {
  Pending: "bg-orange-50 text-orange-600",
  Approved: "bg-emerald-50 text-emerald-600",
  Rejected: "bg-rose-50 text-rose-600",
};

const statusFilters = ["All", "Pending", "Approved", "Rejected"] as const;

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
    requestedOn: formatDate(request.requested_at),
    status: request.status,
    checkIn: formatTime(request.current_check_in),
    checkOut: formatTime(request.current_check_out),
    requestedCheckIn: formatTime(request.requested_check_in),
    requestedCheckOut: formatTime(request.requested_check_out || request.requested_check_in),
    note: request.reason,
  };
}

function AdminRegularizationRequests() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState<RegularizationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof statusFilters)[number]>("All");
  const [selectedRequest, setSelectedRequest] = useState<RegularizationRequest | null>(null);
  const [comment, setComment] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const loadRequests = useCallback(() => {
    setIsLoading(true);

    api
      .get<BackendRequest[]>("/employee-attendance/regularization")
      .then((data) => {
        setRequests(data.map(mapRequest));
        setError("");
      })
      .catch((loadError) => {
        setError(
          loadError instanceof ApiError
            ? loadError.message
            : "Failed to load regularization requests.",
        );
      })
      .finally(() => setIsLoading(false));
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
        request.reason.toLowerCase().includes(query);

      return matchesStatus && matchesQuery;
    });
  }, [requests, search, statusFilter]);

  const counts = useMemo(
    () => ({
      all: requests.length,
      Pending: requests.filter((request) => request.status === "Pending").length,
      Approved: requests.filter((request) => request.status === "Approved").length,
      Rejected: requests.filter((request) => request.status === "Rejected").length,
    }),
    [requests],
  );

  async function reviewRequest(status: "Approved" | "Rejected") {
    if (!selectedRequest) return;

    setIsReviewing(true);
    setReviewError("");

    try {
      await api.patch(
        `/employee-attendance/regularization/${selectedRequest.id}/review`,
        {
          status,
          comment: comment || undefined,
        },
      );

      setRequests((current) =>
        current.map((request) =>
          request.id === selectedRequest.id ? { ...request, status } : request,
        ),
      );
      closeModal();
    } catch (cause) {
      setReviewError(
        cause instanceof ApiError
          ? cause.message
          : `Could not ${status === "Approved" ? "approve" : "reject"} the request. Try again.`,
      );
    } finally {
      setIsReviewing(false);
    }
  }

  function closeModal() {
    setSelectedRequest(null);
    setComment("");
    setReviewError("");
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => navigate("/dashboard/attendance")}
            className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Attendance
          </button>

          <h1 className="text-2xl font-bold text-slate-800">
            Regularization Requests
          </h1>

          <p className="text-sm text-slate-500">
            Review and act on employee attendance correction requests.
          </p>
        </div>

        <GlobalDateBadge prefix="Attendance date" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="relative min-w-[220px] flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, code, department..."
            className="h-10 w-full rounded-full border border-gray-200 bg-white pl-9 pr-4 text-sm text-gray-700 transition focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {statusFilters.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatusFilter(option)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                statusFilter === option
                  ? "border-[#2563eb] bg-blue-50 font-semibold text-[#2563eb]"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {option}
              {option !== "All" && ` (${counts[option]})`}
            </button>
          ))}
        </div>
      </div>

      {/* Requests table */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="pb-3">Employee</th>
                <th className="pb-3">Department</th>
                <th className="pb-3">Attendance Date</th>
                <th className="pb-3">Issue Type</th>
                <th className="pb-3">Requested Change</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Requested On</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-gray-500">
                    Loading requests...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-rose-600">
                    {error}
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-gray-500">
                    No regularization requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-gray-50 last:border-b-0"
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                          {request.employeeName
                            .split(" ")
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")}
                        </span>

                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-800">
                            {request.employeeName}
                          </p>

                          <p className="text-xs text-gray-400">
                            {request.employeeCode}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 text-gray-600">{request.department}</td>

                    <td className="py-3 text-gray-600">{request.date}</td>

                    <td className="py-3 text-gray-600">{request.reason}</td>

                    <td className="py-3">
                      <p className="text-gray-600">
                        {request.requestedCheckIn || "--:--"} →{" "}
                        {request.requestedCheckOut || "--:--"}
                      </p>
                    </td>

                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[request.status]}`}
                      >
                        {request.status}
                      </span>
                    </td>

                    <td className="py-3 text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {request.requestedOn}
                      </span>
                    </td>

                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setComment("");
                          setReviewError("");
                          setSelectedRequest(request);
                        }}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#2563eb] hover:bg-blue-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request details modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <h2 className="text-lg font-bold text-[#17213a]">
                Request Details
              </h2>

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
                      .slice(0, 2)
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

              <h3 className="mb-3 text-sm font-bold text-gray-900">
                Request Information
              </h3>

              <div className="mb-5 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Attendance Date</span>
                  <span className="font-medium text-gray-800">
                    {selectedRequest.date}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">Issue Type</span>
                  <span className="font-medium text-gray-800">
                    {selectedRequest.reason}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">Applied On</span>
                  <span className="font-medium text-gray-800">
                    {selectedRequest.requestedOn}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="shrink-0 text-gray-500">Reason</span>
                  <span className="text-right font-medium text-gray-800">
                    {selectedRequest.note}
                  </span>
                </div>
              </div>

              <div className="mb-5 rounded-xl bg-gray-50 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Current Attendance (As per System)
                </p>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Check-In</p>
                    <p className="font-semibold text-emerald-600">
                      {selectedRequest.checkIn}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Check-Out</p>
                    <p className="font-semibold text-rose-500">
                      {selectedRequest.checkOut}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-5">
                <h3 className="mb-2 text-sm font-bold text-gray-900">
                  Requested Change
                </h3>

                <p className="text-xs text-gray-500">Requested Check-In</p>
                <p className="text-sm font-semibold text-emerald-600">
                  {selectedRequest.requestedCheckIn}
                </p>

                <p className="mt-3 text-xs text-gray-500">
                  Requested Check-Out
                </p>
                <p className="text-sm font-semibold text-emerald-600">
                  {selectedRequest.requestedCheckOut}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="mb-2 text-sm font-bold text-gray-900">
                  Approval
                </h3>

                <label className="mb-1 block text-xs text-gray-500">
                  Add comments (optional)
                </label>

                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value.slice(0, 300))}
                  placeholder="Enter comments here..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-200 p-3 text-sm focus:border-[#2563eb] focus:outline-none"
                />

                <p className="mt-1 text-right text-xs text-gray-400">
                  {comment.length}/300
                </p>
              </div>
            </div>

            {/* Footer actions */}
            <div className="border-t border-gray-100 p-5">
              {reviewError && (
                <p
                  role="alert"
                  className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
                >
                  {reviewError}
                </p>
              )}

              {selectedRequest.status === "Pending" &&
              selectedRequest.employeeCode === currentSessionUser()?.employee_id ? (
                <div className="rounded-lg bg-amber-50 px-4 py-2.5 text-center text-sm font-semibold text-amber-700">
                  This is your own request. It is waiting for another approver.
                </div>
              ) : selectedRequest.status === "Pending" ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => void reviewRequest("Rejected")}
                    disabled={isReviewing}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>

                  <button
                    type="button"
                    onClick={() => void reviewRequest("Approved")}
                    disabled={isReviewing}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    {isReviewing ? "Saving..." : "Approve"}
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

export default AdminRegularizationRequests;
