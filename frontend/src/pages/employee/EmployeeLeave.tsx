import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Plus,
  XCircle,
  X,
} from "lucide-react";
import EmployeeLeaveModal from "./EmployeeLeaveModal";
import EmployeeLeaveDetailsModal from "./EmployeeLeaveDetailsModal";
import { ApiError, api } from "../../services/api";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryKeys";

type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

interface LeaveRequest {
  id: string;
  dateApplied: string;
  leaveType: string;
  from: string;
  to: string;
  duration: number;
  status: LeaveStatus;
  reason: string;
  attachmentUrl: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNote: string | null;
}

interface LeaveBalance {
  type: string;
  available: number;
  allocated: number;
  used: number;
}

interface UpcomingLeave {
  id: string;
  day: string;
  month: string;
  weekday: string;
  leaveType: string;
  dates: string;
}

interface LeaveListResponse {
  items: BackendLeaveRequest[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface BackendLeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  attachment_url: string | null;
  status: LeaveStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendLeaveBalance {
  leave_type: string;
  allocated: number;
  used: number;
  available: number;
}

interface BackendUpcomingLeave {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  attachment_url: string | null;
  status: LeaveStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

interface StoredUser {
  employee_id?: string;
  email?: string;
  full_name?: string;
}

const statusFilters = [
  "All",
  "Pending",
  "Approved",
  "Rejected",
  "Cancelled",
] as const;

type StatusFilter = (typeof statusFilters)[number];

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

function getStatusIcon(status: LeaveStatus) {
  switch (status) {
    case "Approved":
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "Pending":
      return <Clock3 className="h-3.5 w-3.5" />;
    case "Rejected":
      return <XCircle className="h-3.5 w-3.5" />;
    case "Cancelled":
      return <XCircle className="h-3.5 w-3.5" />;
  }
}

function formatDate(dateValue: string) {
  if (!dateValue) {
    return "—";
  }

  const date = new Date(`${dateValue.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateValue: string) {
  if (!dateValue) {
    return "—";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatUpcomingDateRange(startDate: string, endDate: string) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  if (start === end) {
    return start;
  }

  return `${start} – ${end}`;
}

function getUpcomingDateParts(dateValue: string) {
  const date = new Date(`${dateValue.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return {
      day: "—",
      month: "—",
      weekday: "—",
    };
  }

  return {
    day: date.toLocaleDateString("en-GB", {
      day: "2-digit",
    }),
    month: date.toLocaleDateString("en-GB", {
      month: "short",
    }),
    weekday: date.toLocaleDateString("en-GB", {
      weekday: "short",
    }),
  };
}

function normalizeLeaveStatus(status: string): LeaveStatus {
  switch (status.toLowerCase()) {
    case "approved":
      return "Approved";
    case "pending":
      return "Pending";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending";
  }
}

function mapLeaveRequest(request: BackendLeaveRequest): LeaveRequest {
  return {
    id: request.id,
    dateApplied: formatDateTime(request.requested_at),
    leaveType: request.leave_type,
    from: formatDate(request.start_date),
    to: formatDate(request.end_date),
    duration: request.total_days,
    status: normalizeLeaveStatus(request.status),
    reason: request.reason,
    attachmentUrl: request.attachment_url,
    requestedAt: request.requested_at,
    reviewedAt: request.reviewed_at,
    reviewedBy: request.reviewed_by,
    adminNote: request.admin_note,
  };
}

function EmployeeLeave() {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("All");
  const [currentPage, setCurrentPage] = useState(1);

  // The header calendar's day. Only sent once a day other than today has been
  // picked: leave is a list spanning time, so filtering it to a single day by
  // default would hide every request that does not happen to cover today.
  const { date: globalDate, isDefault: isGlobalDateDefault } = useGlobalDate();

  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<LeaveRequest | null>(null);

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [upcomingLeaves, setUpcomingLeaves] = useState<UpcomingLeave[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const getEmployeeId = useCallback(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return null;
    }

    try {
      const user = JSON.parse(storedUser) as StoredUser;

      return user.employee_id ?? null;
    } catch {
      return null;
    }
  }, []);

  const fetchLeaveData = useCallback(
    async (showLoading = true) => {
      const currentEmployeeId = getEmployeeId();

      if (!currentEmployeeId) {
        setError(
          "Employee information could not be found. Please log in again.",
        );
        setLoading(false);
        return;
      }

      setEmployeeId(currentEmployeeId);

      if (showLoading) {
        setLoading(true);
      }

      setError("");

      try {
        const [
          leaveList,
          balanceList,
          upcomingList,
          pendingResponse,
        ] = await Promise.all([
          api.get<LeaveListResponse>(
            `/employee-leave/employees/${currentEmployeeId}`,
            {
              page: 1,
              limit: 100,
              date: isGlobalDateDefault ? undefined : globalDate,
            },
          ),

          api.get<BackendLeaveBalance[]>(
            `/employee-leave/employees/${currentEmployeeId}/balance`,
          ),

          api.get<BackendUpcomingLeave[]>(
            `/employee-leave/employees/${currentEmployeeId}/upcoming`,
          ),

          api.get<{ pending_count: number }>(
            `/employee-leave/employees/${currentEmployeeId}/pending-count`,
          ),
        ]);

        setLeaveRequests(
          leaveList.items.map(mapLeaveRequest),
        );

        setLeaveBalances(
          balanceList.map((balance) => ({
            type: balance.leave_type,
            available: balance.available,
            allocated: balance.allocated,
            used: balance.used,
          })),
        );

        setUpcomingLeaves(
          upcomingList.map((leave) => {
            const dateParts = getUpcomingDateParts(
              leave.start_date,
            );

            return {
              id: leave.id,
              day: dateParts.day,
              month: dateParts.month,
              weekday: dateParts.weekday,
              leaveType: leave.leave_type,
              dates: formatUpcomingDateRange(
                leave.start_date,
                leave.end_date,
              ),
            };
          }),
        );

        setPendingCount(pendingResponse.pending_count);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(
            "Unable to load leave information. Please try again.",
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [getEmployeeId, globalDate, isGlobalDateDefault],
  );

  useEffect(() => {
    void fetchLeaveData();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchLeaveData(false);
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [fetchLeaveData]);

  const filteredRequests = useMemo(() => {
    if (activeFilter === "All") {
      return leaveRequests;
    }

    return leaveRequests.filter(
      (request) => request.status === activeFilter,
    );
  }, [activeFilter, leaveRequests]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / 10),
  );

  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * 10;

    return filteredRequests.slice(
      startIndex,
      startIndex + 10,
    );
  }, [filteredRequests, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleFilterChange = (filter: StatusFilter) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const handleLeaveSubmit = async (
    leaveType: string,
    startDate: string,
    endDate: string,
    reason: string,
    attachment: File | null,
  ) => {
    if (!employeeId) {
      setError(
        "Employee information could not be found. Please log in again.",
      );
      return;
    }

    setActionLoading(true);
    setError("");
    setActionError("");

    try {
      /*
       * The current backend accepts attachment_url, not a file upload.
       * S3/file-upload integration can be added later.
       */
      void attachment;

      await api.post<BackendLeaveRequest>(
        "/employee-leave",
        {
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim(),
          attachment_url: null,
        },
      );

      setIsApplyLeaveOpen(false);

      const targetEmployeeId = employeeId ?? getEmployeeId();
      if (targetEmployeeId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.employee.leaves(targetEmployeeId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.employee.leaveBalances(targetEmployeeId),
        });
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.leaveSummary(),
      });

      await fetchLeaveData(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError(
          "Unable to submit the leave request. Please try again.",
        );
      }
    } finally {
          setActionLoading(false);
    }
  };

  const handleCancelLeave = async (request: LeaveRequest) => {
    if (!employeeId) {
      setError(
        "Employee information could not be found. Please log in again.",
      );
      return;
    }

    if (request.status !== "Pending") {
      return;
    }

    setActionLoading(true);
    setError("");

    try {
      await api.patch<BackendLeaveRequest>(
        `/employee-leave/${request.id}/cancel`,
      );

      setSelectedRequest(null);

      void queryClient.invalidateQueries({
        queryKey: queryKeys.employee.leaves(employeeId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.employee.leaveBalances(employeeId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.leaveSummary(),
      });

      await fetchLeaveData(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(
          "Unable to cancel the leave request. Please try again.",
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  const firstVisibleEntry =
    paginatedRequests.length > 0
      ? (currentPage - 1) * 10 + 1
      : 0;

  const lastVisibleEntry =
    paginatedRequests.length > 0
      ? (currentPage - 1) * 10 + paginatedRequests.length
      : 0;

  return (
    <>
      <div className="min-h-screen bg-[#f5f7fb]">
        {/* Page Header */}
        <div className="border-b border-slate-200 bg-white">
          <div className="px-8 py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  My Leave
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Manage your leave balances and leave requests.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setActionError("");
                  setIsApplyLeaveOpen(true);
                }}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Apply Leave
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-7">
          {/* Error */}
          {error && (
            <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              <span>{error}</span>

              <button
                type="button"
                onClick={() => setError("")}
                className="font-semibold text-red-700 hover:text-red-900"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#2563eb]" />
                <p className="mt-4 text-sm font-medium text-slate-500">
                  Loading your leave information...
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {leaveBalances.map((balance) => (
                  <div
                    key={balance.type}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          {balance.type}
                        </p>

                        <p className="mt-2 text-2xl font-bold text-slate-900">
                          {balance.available}
                          <span className="ml-1 text-sm font-medium text-slate-400">
                            Days
                          </span>
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {balance.allocated} Allocated ·{" "}
                          {balance.used} Used
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pending Requests */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Pending Requests
                      </p>

                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {pendingCount}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Requests Awaiting Approval
                      </p>
                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                      <Clock3 className="h-5 w-5 text-amber-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                {/* Leave Requests */}
                <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-6 pt-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">
                          My Leave Requests
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          View and track your leave applications.
                        </p>
                      </div>

                      <GlobalDateBadge prefix="Covering" />
                    </div>

                    {/* Status Filters */}
                    <div className="mt-5 flex gap-6 overflow-x-auto">
                      {statusFilters.map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() =>
                            handleFilterChange(filter)
                          }
                          className={`relative whitespace-nowrap pb-3 text-sm font-medium transition ${
                            activeFilter === filter
                              ? "text-[#2563eb]"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {filter}

                          {filter === "All" && (
                            <span
                              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                                activeFilter === filter
                                  ? "bg-blue-50 text-blue-600"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {leaveRequests.length}
                            </span>
                          )}

                          {activeFilter === filter && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#2563eb]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px]">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70">
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Date Applied
                          </th>

                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Leave Type
                          </th>

                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            From
                          </th>

                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            To
                          </th>

                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Duration
                          </th>

                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Status
                          </th>

                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {paginatedRequests.length > 0 ? (
                          paginatedRequests.map((request) => (
                            <tr
                              key={request.id}
                              className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                            >
                              <td className="px-6 py-4 text-sm text-slate-600">
                                {request.dateApplied}
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                                    <CalendarDays className="h-4 w-4 text-[#2563eb]" />
                                  </div>

                                  <span className="text-sm font-medium text-slate-800">
                                    {request.leaveType}
                                  </span>
                                </div>
                              </td>

                              <td className="px-6 py-4 text-sm text-slate-600">
                                {request.from}
                              </td>

                              <td className="px-6 py-4 text-sm text-slate-600">
                                {request.to}
                              </td>

                              <td className="px-6 py-4 text-sm font-medium text-slate-700">
                                {request.duration}{" "}
                                {request.duration === 1
                                  ? "Day"
                                  : "Days"}
                              </td>

                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                                    request.status,
                                  )}`}
                                >
                                  {getStatusIcon(request.status)}
                                  {request.status}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedRequest(request)
                                  }
                                  className="text-sm font-medium text-[#2563eb] hover:text-blue-800"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-6 py-12 text-center"
                            >
                              <FileText className="mx-auto h-8 w-8 text-slate-300" />

                              <p className="mt-3 text-sm font-medium text-slate-600">
                                No leave requests found
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                There are no requests under this status.
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer */}
                  <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
                    <p className="text-sm text-slate-500">
                      Showing{" "}
                      <span className="font-medium text-slate-700">
                        {firstVisibleEntry}
                      </span>{" "}
                      to{" "}
                      <span className="font-medium text-slate-700">
                        {lastVisibleEntry}
                      </span>{" "}
                      of{" "}
                      <span className="font-medium text-slate-700">
                        {filteredRequests.length}
                      </span>{" "}
                      entries
                    </p>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={currentPage === 1}
                        onClick={() =>
                          setCurrentPage((page) =>
                            Math.max(1, page - 1),
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563eb] text-sm font-semibold text-white"
                      >
                        {currentPage}
                      </button>

                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() =>
                          setCurrentPage((page) =>
                            Math.min(totalPages, page + 1),
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </section>

                {/* Upcoming Leaves */}
                <aside className="h-fit rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        Upcoming Leaves
                      </h2>

                      <p className="mt-1 text-xs text-slate-500">
                        Your approved upcoming leaves
                      </p>
                    </div>
                    
                  </div>

                  <div className="divide-y divide-slate-100">
                    {upcomingLeaves.length > 0 ? (
                      upcomingLeaves.map((leave) => (
                        <div
                          key={leave.id}
                          className="flex gap-4 px-5 py-5"
                        >
                          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-blue-50">
                            <span className="text-lg font-bold leading-none text-[#2563eb]">
                              {leave.day}
                            </span>

                            <span className="mt-1 text-[10px] font-semibold uppercase text-blue-500">
                              {leave.month}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-800">
                                {leave.leaveType}
                              </p>

                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                                Approved
                              </span>
                            </div>

                            <p className="mt-1 text-xs font-medium text-slate-400">
                              {leave.weekday}
                            </p>

                            <p className="mt-2 text-xs text-slate-500">
                              {leave.dates}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-5 py-10 text-center">
                        <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />

                        <p className="mt-3 text-sm font-medium text-slate-600">
                          No upcoming leaves
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Your approved upcoming leaves will appear here.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200 px-5 py-4">
                    <p className="text-xs leading-5 text-slate-400">
                      Leave balances are calculated based on your company policy.
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Apply Leave Modal */}
      {isApplyLeaveOpen && (
        <EmployeeLeaveModal
          onClose={() => setIsApplyLeaveOpen(false)}
          onSubmit={handleLeaveSubmit}
          isSubmitting={actionLoading}
        />
      )}
      {actionError && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
                <X className="h-5 w-5 text-red-600" />
              </div>

              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900">
                  Leave Request
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {actionError}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setActionError("")}
                className="rounded-xl bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Details Modal */}
      {selectedRequest && (
        <EmployeeLeaveDetailsModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onCancel={handleCancelLeave}
          isCancelling={actionLoading}
        />
      )}
    </>
  );
}

export default EmployeeLeave;