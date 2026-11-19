import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  Wallet,
  ArrowRight,
  ChevronRight,
  LifeBuoy,
} from "lucide-react";
import EmployeeAnnouncementTicker from "../announcements/EmployeeAnnouncementTicker";

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

function isWeekday(date: Date) {
  const day = date.getDay();

  return day !== 0 && day !== 6;
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

function isLateAttendance(record: AttendanceRecord) {
  if (!record.check_in) {
    return false;
  }

  // If backend explicitly marks it as late, trust that.
  if (record.status?.toLowerCase() === "late") {
    return true;
  }

  const value = String(record.check_in).trim();

  // ISO timestamp
  if (value.includes("T")) {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      const istTime = parsed.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const [hours, minutes] = istTime.split(":").map(Number);

      return hours > 9 || (hours === 9 && minutes > 30);
    }
  }

  // 12-hour format: 09:45 AM
  const amPmMatch = value.match(
    /^(\d{1,2}):(\d{2})\s*([AP]M)$/i
  );

  if (amPmMatch) {
    let hours = Number(amPmMatch[1]);
    const minutes = Number(amPmMatch[2]);
    const period = amPmMatch[3].toUpperCase();

    if (period === "PM" && hours !== 12) {
      hours += 12;
    }

    if (period === "AM" && hours === 12) {
      hours = 0;
    }

    return hours > 9 || (hours === 9 && minutes > 30);
  }

  // 24-hour format: 09:45
  const timeMatch = value.match(/(\d{1,2}):(\d{2})/);

  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);

    return hours > 9 || (hours === 9 && minutes > 30);
  }

  return false;
}

function isPresentAttendance(record: AttendanceRecord) {
  const status = record.status?.toLowerCase();

  if (status === "late") {
    return false;
  }

  if (
    status === "present" ||
    status === "working" ||
    status === "overtime"
  ) {
    return true;
  }

  return Boolean(record.check_in) && !isLateAttendance(record);
}

function buildApprovedLeaveDateSet(
  leaveRequests: LeaveRequest[],
) {
  const approvedDates = new Set<string>();

  leaveRequests.forEach((leave) => {
    if (leave.status.toLowerCase() !== "approved") {
      return;
    }

    const start = new Date(
      `${leave.start_date.slice(0, 10)}T00:00:00`,
    );

    const end = new Date(
      `${leave.end_date.slice(0, 10)}T00:00:00`,
    );

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      return;
    }

    const current = new Date(start);

    while (current <= end) {
      approvedDates.add(getDateKey(current));

      current.setDate(current.getDate() + 1);
    }
  });

  return approvedDates;
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
  const firstName = employeeName.split(" ")[0];

  const currentDate = new Date();

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

  /* =========================================================
     ATTENDANCE GRAPH
  ========================================================= */

  const attendanceChart = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const approvedLeaveDates = buildApprovedLeaveDateSet(
      leaveRequests
    );

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = new Date(year, month, day);

      if (!isWeekday(date)) {
        return null;
      }

      const dateKey = getDateKey(date);

      const record = attendanceRecords.find(
        (item: AttendanceRecord) => item.date === dateKey
      );

      let present = 0;
      let late = 0;
      let absent = 0;

      if (record && isLateAttendance(record)) {
        late = 1;
      } else if (record && isPresentAttendance(record)) {
        present = 1;
      } else if (!approvedLeaveDates.has(dateKey)) {
        absent = 1;
      }

      return {
        day,
        present,
        late,
        absent,
      };
    }).filter(
      (
        item
      ): item is {
        day: number;
        present: number;
        late: number;
        absent: number;
      } => item !== null
    );
  }, [attendanceRecords, leaveRequests]);

  const currentMonthLabel = currentDate.toLocaleDateString(
    "en-IN",
    {
      month: "long",
      year: "numeric",
    },
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
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
    <main className="min-w-0 flex-1 space-y-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      {/* =====================================================
          1. HERO GREETING BANNER (Matches PeopleSync mockup)
      ===================================================== */}
      <div className="relative overflow-hidden rounded-3xl border border-blue-100/60 bg-gradient-to-r from-[#e8f1ff] via-[#edf5ff] to-[#f4f8ff] p-6 shadow-xs sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between">
        {/* Left: Greeting + Waving Hand */}
        <div className="flex items-center gap-4.5 z-10">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200/70 text-3xl shadow-xs">
            👋
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-manrope">
              {greeting}, {firstName}!
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Here's what's happening with your work and attendance today.
            </p>
          </div>
        </div>

        {/* Right: Modern Workstation Illustration */}
        <div className="hidden md:block relative w-80 h-28 shrink-0 pointer-events-none select-none z-0">
          <svg
            className="w-full h-full object-contain"
            viewBox="0 0 320 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Background skyline/shelves */}
            <rect x="230" y="35" width="10" height="70" rx="2" fill="#bfdbfe" fillOpacity="0.4" />
            <rect x="245" y="15" width="12" height="90" rx="2" fill="#93c5fd" fillOpacity="0.5" />
            <rect x="262" y="45" width="9" height="60" rx="2" fill="#bfdbfe" fillOpacity="0.35" />

            {/* Desk Surface */}
            <line x1="70" y1="102" x2="310" y2="102" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6" />

            {/* Laptop Base and Screen */}
            <rect x="150" y="55" width="70" height="42" rx="4" fill="#0f172a" />
            <rect x="154" y="59" width="62" height="34" rx="2" fill="#0066ff" fillOpacity="0.88" />
            <line x1="161" y1="68" x2="186" y2="68" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.9" />
            <line x1="161" y1="74" x2="202" y2="74" stroke="#bfdbfe" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="161" y1="80" x2="180" y2="80" stroke="#bfdbfe" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M142 98 L228 98 L222 102 L148 102 Z" fill="#64748b" />
            <rect x="175" y="99" width="20" height="2" rx="1" fill="#cbd5e1" />

            {/* Potted Plant */}
            <path d="M255 82 L269 82 L266 102 L258 102 Z" fill="#3b82f6" fillOpacity="0.85" />
            <ellipse cx="262" cy="74" rx="5" ry="9" fill="#10b981" />
            <ellipse cx="258" cy="77" rx="6" ry="7" transform="rotate(-25 258 77)" fill="#059669" />
            <ellipse cx="266" cy="77" rx="6" ry="7" transform="rotate(25 266 77)" fill="#34d399" />

            {/* Soft Ambient Glow */}
            <circle cx="280" cy="50" r="40" fill="#60a5fa" fillOpacity="0.15" />
          </svg>
        </div>
      </div>

      {/* Announcement Ticker */}
      <EmployeeAnnouncementTicker
        announcements={announcements}
        loading={loadingAnnouncements}
        error={announcementError}
      />

      {/* =====================================================
          2. TOP KPI CARDS (4 Modern PeopleSync Cards)
      ===================================================== */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {/* Today's Attendance */}
        <div
          onClick={() => navigate("/employee/attendance")}
          className="group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-100 bg-white p-5.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition group-hover:bg-blue-50 group-hover:text-blue-600">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="mt-4">
            <p className="text-2xl font-bold font-manrope text-slate-900">
              {todayAttendance?.check_in ? "Checked In" : "Not Marked"}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400 font-manrope">
              Today's Attendance
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>In: <strong className="font-semibold text-slate-700">{formatTime(todayAttendance?.check_in ?? null)}</strong></span>
            <span>Out: <strong className="font-semibold text-slate-700">{formatTime(todayAttendance?.check_out ?? null)}</strong></span>
          </div>
        </div>

        {/* Leave Balance */}
        <div
          onClick={() => navigate("/employee/leave")}
          className="group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-100 bg-white p-5.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-100">
              <CalendarDays className="h-6 w-6" />
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition group-hover:bg-blue-50 group-hover:text-blue-600">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="mt-4">
            <p className="text-2xl font-bold font-manrope text-slate-900">
              {loadingLeave ? "..." : `${totalLeaveBalance} Days`}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400 font-manrope">
              Available Leave Balance
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium">Casual: {getBalanceForType("Casual Leave")}</span>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium">Sick: {getBalanceForType("Sick Leave")}</span>
          </div>
        </div>

        {/* Pending Requests */}
        <div
          onClick={() => navigate("/employee/leave")}
          className="group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-100 bg-white p-5.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 transition-colors group-hover:bg-purple-100">
              <Clock className="h-6 w-6" />
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition group-hover:bg-blue-50 group-hover:text-blue-600">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="mt-4">
            <p className="text-2xl font-bold font-manrope text-slate-900">
              {pendingLeaveCount}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400 font-manrope">
              Pending Leave Requests
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>{pendingLeaveCount === 1 ? "1 request awaiting review" : `${pendingLeaveCount} requests awaiting review`}</span>
          </div>
        </div>

        {/* My Payslip */}
        <div
          onClick={() => navigate("/employee/payroll")}
          className="group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-100 bg-white p-5.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#0066ff] transition-colors group-hover:bg-blue-100">
              <Wallet className="h-6 w-6" />
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition group-hover:bg-blue-50 group-hover:text-blue-600">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="mt-4">
            <p className="text-2xl font-bold font-manrope text-slate-900">
              {loadingPayroll
                ? "..."
                : latestPayroll
                  ? `₹${latestPayroll.net_salary.toLocaleString("en-IN")}`
                  : "No Payslip"}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400 font-manrope">
              Latest Net Salary
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>{latestPayroll ? `${latestPayroll.month} · View Slip` : "Awaiting payroll run"}</span>
          </div>
        </div>
      </section>

      {/* =====================================================
          3. ATTENDANCE OVERVIEW + QUICK ACTIONS
      ===================================================== */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Attendance Overview Chart */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-bold font-manrope text-slate-900">
                  Attendance Overview
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Monthly daily attendance for {currentMonthLabel}
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-700">
              <span>{currentMonthLabel}</span>
            </div>
          </div>

          {/* Chart visual */}
          <div className="mt-6">
            {attendanceChart.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-slate-400">
                No attendance records for this month yet.
              </div>
            ) : (
              <div className="relative h-56">
                {/* Horizontal Guide Lines */}
                <div className="absolute inset-0 flex flex-col justify-between">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="border-t border-dashed border-slate-100" />
                  ))}
                </div>

                {/* Bars */}
                <div className="absolute inset-x-0 bottom-6 top-2 flex items-end gap-1 overflow-hidden px-1 sm:gap-2">
                  {attendanceChart.map((item) => {
                    return (
                      <div
                        key={item.day}
                        className="flex h-full flex-1 items-end justify-center"
                        title={`Day ${item.day}: ${
                          item.late
                            ? "Late"
                            : item.present
                              ? "Present"
                              : item.absent
                                ? "Absent"
                                : "No record / Off"
                        }`}
                      >
                        {item.present === 1 ? (
                          <div className="h-[88%] w-full max-w-3 rounded-t-md bg-[#0066ff] shadow-xs shadow-blue-500/20" />
                        ) : item.late === 1 ? (
                          <div className="h-[65%] w-full max-w-3 rounded-t-md bg-[#f97316] shadow-xs shadow-orange-500/20" />
                        ) : item.absent === 1 ? (
                          <div className="h-[35%] w-full max-w-3 rounded-t-md bg-rose-500" />
                        ) : (
                          <div className="h-1 w-full max-w-3 rounded-t-full bg-slate-200" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* X Axis Labels */}
                <div className="absolute bottom-0 inset-x-0 flex justify-between px-1 text-[10px] font-medium text-slate-400">
                  <span>Day 1</span>
                  <span>Day 10</span>
                  <span>Day 20</span>
                  <span>Day {attendanceChart[attendanceChart.length - 1]?.day ?? 30}</span>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2.5 w-2.5 rounded-full bg-[#0066ff]" />
                Present
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
                Late
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Absent
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions (Matching PeopleSync pastel card design) */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-blue-600 font-bold">⚡</span>
              <h2 className="text-base font-bold font-manrope text-slate-900">
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
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-emerald-100/70 bg-emerald-50/50 p-4 text-center transition hover:bg-emerald-100/60"
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
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-amber-100/70 bg-amber-50/50 p-4 text-center transition hover:bg-amber-100/60"
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
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-blue-100/70 bg-blue-50/50 p-4 text-center transition hover:bg-blue-100/60"
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
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-purple-100/70 bg-purple-50/50 p-4 text-center transition hover:bg-purple-100/60"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                <LifeBuoy className="h-5 w-5" />
              </div>
              <span className="text-xs font-semibold text-purple-800">
                Helpdesk
              </span>
            </button>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-500">
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
      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold font-manrope text-slate-900">
              My Leave Requests
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Recent leave applications and their current approval status
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/employee/leave")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0066ff] hover:underline"
          >
            View All Leaves <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
          {loadingLeave ? (
            <div className="py-8 text-center text-sm text-slate-400">
              Loading leave requests...
            </div>
          ) : leaveError ? (
            <div className="py-8 text-center text-sm text-rose-500">
              {leaveError}
            </div>
          ) : leaveRequests.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No leave requests submitted yet.
            </div>
          ) : (
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400 font-manrope">
                  <th className="pb-3">Date Range</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Duration</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveRequests.slice(0, 5).map((request: LeaveRequest) => {
                  const status = getDisplayLeaveStatus(request.status);
                  const isApproved = status === "Approved";
                  const isRejected = status === "Rejected";

                  return (
                    <tr key={request.id} className="transition-colors hover:bg-slate-50/50">
                      <td className="py-3.5 font-medium text-slate-800">
                        {formatLeaveDate(request.start_date)}
                        {request.start_date.slice(0, 10) !== request.end_date.slice(0, 10) && (
                          <> - {formatLeaveDate(request.end_date)}</>
                        )}
                      </td>
                      <td className="py-3.5 text-slate-600">
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {request.leave_type}
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-600">
                        {request.total_days} {request.total_days === 1 ? "day" : "days"}
                      </td>
                      <td className="py-3.5">
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

      {/* Footer */}
      <footer className="border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} PeopleSync. Empowering People, Simplifying Work. · Employee Self-Service
      </footer>
    </main>
  );
}

export default EmployeeDashboard;
