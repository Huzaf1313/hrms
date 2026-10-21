import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Hand, Check } from "lucide-react";

import {
  useEmployeeAttendance,
  useEmployeeLeaves,
  useEmployeeLeaveBalances,
  useEmployeeAnnouncements,
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

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
  reason?: string | null;
  requested_at?: string | null;
}

interface AttendanceRecord {
  date: string;
  check_in: string | null;
  check_out: string | null;
  in_time?: string | null;
  out_time?: string | null;
  status?: string | null;
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

function formatAnnouncementDate(value?: string | null) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function getLeaveStatusClass(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "approved") {
    return "bg-green-100 text-green-700";
  }

  if (normalized === "rejected") {
    return "bg-red-100 text-red-700";
  }

  if (normalized === "cancelled" || normalized === "canceled") {
    return "bg-gray-100 text-gray-600";
  }

  return "bg-yellow-100 text-yellow-700";
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
  } = useEmployeeAnnouncements(1, 3);

  const attendanceRecords = useMemo(() => {
    return (rawAttendanceRecords || []).map(normalizeAttendance);
  }, [rawAttendanceRecords]);

  const todayAttendance = useMemo(() => {
    const todayKey = getDateKey(new Date());
    return (
      attendanceRecords.find((item) => getDateKey(item.date) === todayKey) ??
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
      (item) =>
        item.leave_type.trim().toLowerCase() ===
        type.trim().toLowerCase(),
    );

    return balance?.available ?? 0;
  };

  const totalLeaveBalance = useMemo(() => {
    return leaveBalances.reduce(
      (total, balance) =>
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
      (item) => item.date === dateKey
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

  /* =========================================================
     RETURN
  ========================================================= */

  return (
    <main className="min-w-0 flex-1 bg-[#f5f7fb] px-5 py-7 text-[#17213a] sm:px-7 lg:px-10">
      {/* =====================================================
          GREETING
      ===================================================== */}

      <section className="mb-7">
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#171b1d] sm:text-4xl">
          Good Morning, {firstName} <Hand aria-hidden="true" className="inline h-5 w-5 align-middle" />
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Here's what's happening with your work today.
        </p>
      </section>

      {/* =====================================================
          KPI CARDS
      ===================================================== */}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {/* ===================================================
            TODAY'S ATTENDANCE
        =================================================== */}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Today's Attendance
              </p>

              <p className="mt-3 text-2xl font-bold text-[#17213a]">
                {todayAttendance?.check_in
                  ? "Checked In"
                  : "Not Marked"}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
              <Check aria-hidden="true" className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">
                Punch In
              </span>

              <span className="font-semibold text-gray-700">
                {formatTime(
                  todayAttendance?.check_in ?? null,
                )}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">
                Punch Out
              </span>

              <span className="font-semibold text-gray-400">
                {formatTime(
                  todayAttendance?.check_out ?? null,
                )}
              </span>
            </div>
          </div>
        </div>

        {/* ===================================================
            LEAVE BALANCE
        =================================================== */}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Leave Balance
              </p>

              <p className="mt-3 text-2xl font-bold text-[#17213a]">
                {loadingLeave
                  ? "..."
                  : `${totalLeaveBalance} Days`}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              ◷
            </div>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 p-2">
              <p className="text-lg font-bold">
                {getBalanceForType("Casual Leave")}
              </p>

              <p className="text-[10px] text-gray-500">
                Casual
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-2">
              <p className="text-lg font-bold">
                {getBalanceForType("Sick Leave")}
              </p>

              <p className="text-[10px] text-gray-500">
                Sick
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-2">
              <p className="text-lg font-bold">
                {getBalanceForType("Earned Leave")}
              </p>

              <p className="text-[10px] text-gray-500">
                Earned
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-2">
              <p className="text-lg font-bold">
                {getBalanceForType("Comp Off")}
              </p>

              <p className="text-[10px] text-gray-500">
                Comp Off
              </p>
            </div>
          </div>

          {leaveError && (
            <p className="mt-3 text-xs text-red-500">
              {leaveError}
            </p>
          )}
        </div>

        {/* ===================================================
            PAYSLIP
        =================================================== */}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                My Payslip
              </p>

              <p className="mt-3 text-2xl font-bold text-[#17213a]">
                ₹48,750
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              ₹
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-500">
            July 2026 · Take-home salary
          </p>

          <button
            type="button"
            onClick={() => navigate("/employee/payroll")}
            className="mt-4 text-sm font-semibold text-[#2563eb] hover:underline"
          >
            View Payslip →
          </button>
        </div>
      </section>

      {/* =====================================================
          ATTENDANCE + ANNOUNCEMENTS
      ===================================================== */}

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        {/* ===================================================
            ATTENDANCE OVERVIEW
        =================================================== */}

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#17213a]">
                Attendance Overview
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Real-time attendance for {currentMonthLabel}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
              {currentMonthLabel}
            </div>
          </div>

          {/* Chart */}
          <div className="mt-8">
            {attendanceChart.length === 0 ? (
              <div className="flex h-[230px] items-center justify-center text-sm text-gray-400">
                No attendance data available.
              </div>
            ) : (
              <div className="relative h-[230px]">
                {/* Grid */}
                <div className="absolute inset-0 flex flex-col justify-between">
                  {[1, 2, 3, 4, 5].map((line) => (
                    <div
                      key={line}
                      className="border-t border-dashed border-gray-200"
                    />
                  ))}
                </div>

                {/* Chart visualization */}
                <div className="absolute inset-x-0 bottom-6 top-4 flex items-end gap-1 overflow-hidden px-2 sm:gap-2">
                  {attendanceChart.map((item) => {
                    const hasAttendance =
                      item.present || item.late || item.absent;

                    return (
                      <div
                        key={item.day}
                        className="flex h-full flex-1 items-end justify-center"
                        title={`${item.day}: ${
                          item.late
                            ? "Late"
                            : item.present
                              ? "Present"
                              : item.absent
                                ? "Absent"
                                : "Approved Leave / No record"
                        }`}
                      >
                        {hasAttendance ? (
                          <div className="flex h-full w-full max-w-3 items-end justify-center">
                            {item.late === 1 ? (
                              <div className="h-[65%] w-full rounded-t-full bg-orange-400" />
                            ) : item.present === 1 ? (
                              <div className="h-[90%] w-full rounded-t-full bg-[#2563eb]" />
                            ) : item.absent === 1 ? (
                              <div className="h-[35%] w-full rounded-t-full bg-red-400" />
                            ) : null}
                          </div>
                        ) : (
                          <div className="h-0 w-full max-w-3" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* X Axis */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-[10px] text-gray-400 sm:text-xs">
                  <span>
                    {attendanceChart[0]?.day}
                  </span>

                  {attendanceChart.length > 7 && (
                    <span>
                      {attendanceChart[
                        Math.floor(
                          attendanceChart.length / 4,
                        )
                      ]?.day}
                    </span>
                  )}

                  {attendanceChart.length > 14 && (
                    <span>
                      {attendanceChart[
                        Math.floor(
                          attendanceChart.length / 2,
                        )
                      ]?.day}
                    </span>
                  )}

                  {attendanceChart.length > 21 && (
                    <span>
                      {attendanceChart[
                        Math.floor(
                          (attendanceChart.length * 3) / 4,
                        )
                      ]?.day}
                    </span>
                  )}

                  <span>
                    {
                      attendanceChart[
                        attendanceChart.length - 1
                      ]?.day
                    }
                  </span>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="mt-5 flex flex-wrap gap-5 text-xs text-gray-500">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" />
                Present
              </span>

              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
                Late
              </span>

              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                Absent
              </span>
            </div>
          </div>
        </div>

        {/* ===================================================
            RECENT ANNOUNCEMENTS
        =================================================== */}

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#17213a]">
                Recent Announcements
              </h2>

              <div className="mt-5 space-y-4">
                {announcements.length === 0 ? (
                  <p className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-6 text-center text-xs text-gray-500">
                    No announcements available.
                  </p>
                ) : (
                  announcements.map((announcement) => (
                    <div
                      key={announcement.id}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-semibold text-gray-800">
                          {announcement.title}
                        </h3>

                        <span className="shrink-0 text-xs text-gray-400">
                          {new Date(
                            `${announcement.published_at}T00:00:00`,
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "2-digit",
                          })}
                        </span>
                      </div>

                      <p className="mt-2 text-xs leading-5 text-gray-500">
                        {announcement.description}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/employee/announcements")
              }
              className="text-sm font-semibold text-[#2563eb]"
            >
              View All
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {loadingAnnouncements ? (
              <div className="py-8 text-center text-sm text-gray-400">
                Loading announcements...
              </div>
            ) : announcementError ? (
              <div className="py-8 text-center text-sm text-red-500">
                {announcementError}
              </div>
            ) : announcements.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                No announcements available.
              </div>
            ) : (
              announcements.map((announcement) => (
                <div
                  key={
                    announcement.id ??
                    `${announcement.title}-${announcement.published_at}`
                  }
                  className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-gray-800">
                      {announcement.title}
                    </h3>

                    <span className="shrink-0 text-xs text-gray-400">
                      {formatAnnouncementDate(
                        announcement.published_at,
                      )}
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">
                    {announcement.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* =====================================================
          MY LEAVE REQUESTS
      ===================================================== */}

      <section className="mt-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-[#17213a]">
              My Leave Requests
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Recent leave applications
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            {loadingLeave ? (
              <div className="py-8 text-center text-sm text-gray-400">
                Loading leave requests...
              </div>
            ) : leaveError ? (
              <div className="py-8 text-center text-sm text-red-500">
                {leaveError}
              </div>
            ) : leaveRequests.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                No leave requests available.
              </div>
            ) : (
              <table className="w-full min-w-[600px] text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="pb-3 font-semibold">
                      Date
                    </th>

                    <th className="pb-3 font-semibold">
                      Category
                    </th>

                    <th className="pb-3 font-semibold">
                      Duration
                    </th>

                    <th className="pb-3 font-semibold">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {leaveRequests
                    .slice(0, 5)
                    .map((request) => {
                      const status =
                        getDisplayLeaveStatus(
                          request.status,
                        );

                      return (
                        <tr
                          key={request.id}
                          className="border-b border-gray-50 last:border-0"
                        >
                          <td className="py-4 text-sm font-medium text-gray-700">
                            {formatLeaveDate(
                              request.start_date,
                            )}

                            {request.start_date.slice(
                              0,
                              10,
                            ) !==
                              request.end_date.slice(
                                0,
                                10,
                              ) && (
                              <>
                                {" "}
                                -{" "}
                                {formatLeaveDate(
                                  request.end_date,
                                )}
                              </>
                            )}
                          </td>

                          <td className="py-4 text-sm text-gray-500">
                            {request.leave_type}
                          </td>

                          <td className="py-4 text-sm text-gray-500">
                            {request.total_days}{" "}
                            {request.total_days === 1
                              ? "day"
                              : "days"}
                          </td>

                          <td className="py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getLeaveStatusClass(
                                request.status,
                              )}`}
                            >
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

          {leaveRequests.length > 5 && (
            <div className="mt-4 border-t border-gray-100 pt-4 text-right">
              <button
                type="button"
                onClick={() => navigate("/employee/leave")}
                className="text-sm font-semibold text-[#2563eb] hover:underline"
              >
                View All Leave Requests →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="mt-8 border-t border-gray-200 py-6 text-center text-xs text-gray-400">
        © 2026 HRMS. All rights reserved. · Employee Portal
      </footer>
    </main>
  );
}

export default EmployeeDashboard;
