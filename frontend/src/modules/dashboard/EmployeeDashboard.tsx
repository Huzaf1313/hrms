import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  Wallet,
  ChevronRight,
  LifeBuoy,
} from "lucide-react";
import AnnouncementMarquee from "../announcements/AnnouncementMarquee";
import { Button } from "../../components/ui";
import EmployeeAttendanceOverviewCard from "./EmployeeAttendanceOverviewCard";

import {
  useEmployeeAttendance,
  useEmployeeLeaves,
  useEmployeeLeaveBalances,
  useEmployeeAnnouncements,
  useEmployeeLatestPayroll,
} from "../../hooks/useEmployeeData";
import type {
  AttendanceRecord,
  LeaveBalance,
  LeaveRequest,
} from "../../hooks/useEmployeeData";

interface User {
  id: string;
  employee_id?: string | null;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

function normalizeAttendance(
  record: AttendanceRecord,
): AttendanceRecord {
  return {
    ...record,
    check_in: record.check_in ?? record.in_time ?? null,
    check_out: record.check_out ?? record.out_time ?? null,
  };
}

function getDateKey(value: string | Date) {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return value.slice(0, 10);
}

function formatLeaveDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDisplayLeaveStatus(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "approved") {
    return "Approved";
  }

  if (normalized === "rejected") {
    return "Rejected";
  }

  if (normalized === "cancelled" || normalized === "canceled") {
    return "Cancelled";
  }

  return "Pending";
}

function EmployeeDashboard() {
  const navigate = useNavigate();

  const user = useMemo<User | null>(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return null;
    }

    try {
      return JSON.parse(storedUser) as User;
    } catch {
      return null;
    }
  }, []);

  const employeeName = user?.full_name || "Employee";
  const firstName = (employeeName.trim().split(/\s+/)[0] || "Employee").toUpperCase();

  const { data: rawAttendanceRecords } = useEmployeeAttendance(
    user?.employee_id,
  );
  const {
    data: leaveListResponse,
    isLoading: loadingLeave,
    isError: hasLeaveError,
  } = useEmployeeLeaves(user?.employee_id);
  const { data: balanceListResponse } = useEmployeeLeaveBalances(
    user?.employee_id,
  );
  const {
    data: announcementResponse,
    isLoading: loadingAnnouncements,
    isError: hasAnnouncementError,
  } = useEmployeeAnnouncements(1, 100);
  const { data: latestPayroll, isLoading: loadingPayroll } =
    useEmployeeLatestPayroll(user?.employee_id);

  const attendanceRecords = useMemo(() => {
    return (rawAttendanceRecords || []).map(normalizeAttendance);
  }, [rawAttendanceRecords]);

  const todayAttendance = useMemo(() => {
    const todayKey = getDateKey(new Date());
    return (
      attendanceRecords.find(
        (item: AttendanceRecord) => getDateKey(item.date) === todayKey,
      ) ??
      null
    );
  }, [attendanceRecords]);

  const leaveRequests = useMemo(
    () => leaveListResponse?.items || [],
    [leaveListResponse],
  );
  const leaveBalances = useMemo(
    () => balanceListResponse || [],
    [balanceListResponse],
  );
  const announcements = useMemo(
    () => (announcementResponse?.announcements || []).slice(0, 3),
    [announcementResponse],
  );
  const leaveError = hasLeaveError
    ? "Unable to load leave information."
    : "";
  const announcementError = hasAnnouncementError
    ? "Unable to load announcements."
    : "";

  /* =========================================================
     TIME FORMATTER
  ========================================================= */

  function formatTime(value: string | null) {
    if (!value) {
      return "--";
    }

    const text = value.trim();

    if (/^\d{1,2}:\d{2}\s*[AP]M$/i.test(text)) {
      return text;
    }

    const hasTimezone =
      /(?:Z|[+-]\d{2}:\d{2})$/i.test(text);

    const parsedValue = new Date(
      hasTimezone ? text : `${text}Z`,
    );

    return Number.isNaN(parsedValue.getTime())
      ? "--"
      : parsedValue.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
      });
  }

  /* =========================================================
     LEAVE BALANCE
  ========================================================= */

  const getBalanceForType = (type: string) => {
    const balance = leaveBalances.find(
      (item: LeaveBalance) =>
        item.leave_type.trim().toLowerCase() ===
        type.trim().toLowerCase(),
    );

    return balance?.available ?? 0;
  };

  const totalLeaveBalance = useMemo(() => {
    return leaveBalances.reduce(
      (total: number, balance: LeaveBalance) =>
        total + Number(balance.available || 0),
      0,
    );
  }, [leaveBalances]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    if (hour >= 17 && hour < 21) return "Good evening";
    return "Good night";
  }, []);

  const pendingLeaveCount = useMemo(() => {
    return leaveRequests.filter(
      (r: LeaveRequest) => r.status.toLowerCase() === "pending",
    ).length;
  }, [leaveRequests]);

  /* =========================================================
     RETURN
  ========================================================= */

  return (
    <div className="space-y-5 pb-12">
      {/* Slim page header (matches Super Admin / HR / Manager dashboard) */}
      <div className="flex flex-col gap-4 border-b border-[#E5E7EB] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight leading-[1.3] text-slate-900">
            {greeting}, {firstName}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/employee/attendance")}
            leftIcon={<CalendarCheck className="h-4 w-4" />}
          >
            Mark Attendance
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/employee/leave")}
            leftIcon={<CalendarDays className="h-4 w-4" />}
          >
            Apply Leave
          </Button>
        </div>
      </div>

      {/* Announcement Marquee */}
      <AnnouncementMarquee
        announcements={announcements}
        loading={loadingAnnouncements}
        error={announcementError}
        onViewAll={() => navigate("/employee/announcements")}
      />

      {/* =====================================================
          2. TOP KPI CARDS
      ===================================================== */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Today's Attendance */}
        <div
          onClick={() => navigate("/employee/attendance")}
          className="flex min-h-[128px] cursor-pointer flex-col rounded-[2px] border-2 border-[#E5E7EB] bg-white p-5 shadow-kpi shadow-kpi-hover transition hover:border-[#D1D5DB]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-[#6B7280]">Today&apos;s Attendance</p>
              <p className="mt-2 text-[24px] font-semibold leading-none text-[#111827]">
                {todayAttendance?.check_in ? "Punch In" : "Not Marked"}
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CalendarCheck className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-auto flex items-center justify-between pt-3 text-[12px] text-[#6B7280]">
            <span>In: <strong className="font-medium text-[#111827]">{formatTime(todayAttendance?.check_in ?? null)}</strong></span>
            <span>Out: <strong className="font-medium text-[#111827]">{formatTime(todayAttendance?.check_out ?? null)}</strong></span>
          </div>
        </div>

        {/* Leave Balance */}
        <div
          onClick={() => navigate("/employee/leave")}
          className="flex min-h-[128px] cursor-pointer flex-col rounded-[2px] border-2 border-[#E5E7EB] bg-white p-5 shadow-kpi shadow-kpi-hover transition hover:border-[#D1D5DB]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-[#6B7280]">Available Leave Balance</p>
              <p className="mt-2 text-[24px] font-semibold leading-none text-[#111827]">
                {loadingLeave ? "..." : `${totalLeaveBalance} Days`}
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <CalendarDays className="h-4 w-4" />
            </span>
          </div>

          <p className="mt-auto pt-3 text-[12px] text-[#6B7280]">
            Casual: {getBalanceForType("Casual Leave")} · Sick: {getBalanceForType("Sick Leave")}
          </p>
        </div>

        {/* Pending Requests */}
        <div
          onClick={() => navigate("/employee/leave")}
          className="flex min-h-[128px] cursor-pointer flex-col rounded-[2px] border-2 border-[#E5E7EB] bg-white p-5 shadow-kpi shadow-kpi-hover transition hover:border-[#D1D5DB]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-[#6B7280]">Pending Leave Requests</p>
              <p className="mt-2 text-[24px] font-semibold leading-none text-[#111827]">
                {pendingLeaveCount}
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>

          <p className="mt-auto pt-3 text-[12px] text-[#6B7280]">
            {pendingLeaveCount === 1 ? "1 request awaiting review" : `${pendingLeaveCount} requests awaiting review`}
          </p>
        </div>

        {/* My Payslip */}
        <div
          onClick={() => navigate("/employee/payroll")}
          className="flex min-h-[128px] cursor-pointer flex-col rounded-[2px] border-2 border-[#E5E7EB] bg-white p-5 shadow-kpi shadow-kpi-hover transition hover:border-[#D1D5DB]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-[#6B7280]">Latest Net Salary</p>
              <p className="mt-2 text-[24px] font-semibold leading-none text-[#111827]">
                {loadingPayroll
                  ? "..."
                  : latestPayroll
                    ? `₹${latestPayroll.net_salary.toLocaleString("en-IN")}`
                    : "No Payslip"}
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
              <Wallet className="h-4 w-4" />
            </span>
          </div>

          <p className="mt-auto pt-3 text-[12px] text-[#6B7280]">
            {latestPayroll ? `${latestPayroll.month} · View Slip` : "Awaiting payroll run"}
          </p>
        </div>
      </section>

      {/* =====================================================
          3. ATTENDANCE OVERVIEW + QUICK ACTIONS
      ===================================================== */}
      <section className="grid grid-cols-12 items-stretch gap-4">
        <EmployeeAttendanceOverviewCard
          employeeId={user?.employee_id}
          leaveRequests={leaveRequests}
          loadingLeaves={loadingLeave}
          hasLeaveError={hasLeaveError}
        />

        {/* Quick Actions */}
        <div className="col-span-12 flex flex-col justify-between rounded-[2px] border border-[#E5E7EB] bg-white p-5 lg:col-span-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-blue-600 font-bold">⚡</span>
              <h2 className="text-base font-bold text-slate-900">
                Quick Actions
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Instant shortcuts to common actions
            </p>
          </div>

          <div className="my-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => navigate("/employee/attendance")}
              className="flex flex-col items-center justify-center gap-2 rounded-[2px] border border-emerald-100/70 bg-emerald-50/50 p-4 text-center transition hover:bg-emerald-100/60"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-emerald-800">
                Punch In / Out
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/employee/leave")}
              className="flex flex-col items-center justify-center gap-2 rounded-[2px] border border-amber-100/70 bg-amber-50/50 p-4 text-center transition hover:bg-amber-100/60"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <CalendarDays className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-amber-800">
                Apply Leave
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/employee/payroll")}
              className="flex flex-col items-center justify-center gap-2 rounded-[2px] border border-blue-100/70 bg-blue-50/50 p-4 text-center transition hover:bg-blue-100/60"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-[#0066ff]">
                <Wallet className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-blue-800">
                View Payslip
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/employee/help")}
              className="flex flex-col items-center justify-center gap-2 rounded-[2px] border border-purple-100/70 bg-purple-50/50 p-4 text-center transition hover:bg-purple-100/60"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                <LifeBuoy className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-purple-800">
                Helpdesk
              </span>
            </button>
          </div>

          <div className="rounded-[2px] bg-slate-50 p-3 text-center text-xs text-slate-500">
            Have an attendance discrepancy?{" "}
            <button
              type="button"
              onClick={() => navigate("/employee/attendance")}
              className="font-semibold text-[#0066ff] hover:underline"
            >
              Request Regularization
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================
          4. MY RECENT LEAVE REQUESTS TABLE
      ===================================================== */}
      <section className="overflow-hidden rounded-[2px] border border-[#E5E7EB] bg-white">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
          <div>
            <h2 className="text-[14px] font-semibold text-[#111827]">
              My Leave Requests
            </h2>
            <p className="mt-0.5 text-[12px] text-[#6B7280]">
              Recent leave applications and their current approval status
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/employee/leave")}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[#2563EB] hover:text-[#1D4ED8]"
          >
            View All Leaves <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          {loadingLeave ? (
            <div className="py-8 text-center text-sm text-[#6B7280]">
              Loading leave requests...
            </div>
          ) : leaveError ? (
            <div className="py-8 text-center text-sm text-rose-500">
              {leaveError}
            </div>
          ) : leaveRequests.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#6B7280]">
              No leave requests submitted yet.
            </div>
          ) : (
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                  <th className="px-5 py-3">Date Range</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Duration</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {leaveRequests.slice(0, 5).map((request: LeaveRequest) => {
                  const status = getDisplayLeaveStatus(request.status);
                  const isApproved = status === "Approved";
                  const isRejected = status === "Rejected";

                  return (
                    <tr key={request.id} className="transition-colors hover:bg-[#F9FAFB]">
                      <td className="px-5 py-3.5 text-[13px] font-medium text-[#111827]">
                        {formatLeaveDate(request.start_date)}
                        {request.start_date.slice(0, 10) !== request.end_date.slice(0, 10) && (
                          <> - {formatLeaveDate(request.end_date)}</>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[#4B5563]">
                        <span className="rounded-lg bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#374151]">
                          {request.leave_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-[#4B5563]">
                        {request.total_days} {request.total_days === 1 ? "day" : "days"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                            isApproved
                              ? "bg-emerald-50 text-emerald-700"
                              : isRejected
                                ? "bg-rose-50 text-rose-700"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isApproved
                                ? "bg-emerald-600"
                                : isRejected
                                  ? "bg-rose-600"
                                  : "bg-amber-600"
                            }`}
                          />
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export default EmployeeDashboard;
