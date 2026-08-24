import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../services/api";

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

interface EmployeeAttendanceProps {
  onLogout: () => void;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  total_hours: number | null;
  remarks: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface EmployeeAttendanceProps {
  onLogout: () => void;
}

function EmployeeAttendance({
  onLogout,
}: EmployeeAttendanceProps) {
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
  const initials = getInitials(employeeName);

  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

useEffect(() => {
  async function loadAttendance() {
    if (!user?.email) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Find the employee record belonging to the logged-in user.
      const employees = await api.get<
        Array<{
          id: string;
          employee_id: string;
          first_name: string;
          last_name: string;
          email: string;
        }>
      >("/employees", {
        page: 1,
        limit: 100,
      });

      const employee = employees.find(
        (item) =>
          item.email.toLowerCase() ===
          user.email.toLowerCase(),
      );

      if (!employee) {
        setError(
          "Employee profile could not be found for the logged-in user.",
        );
        return;
      }

      // Use the MongoDB employee document ID for attendance.
      const records = await api.get<AttendanceRecord[]>(
        `/employees/${employee.id}/attendance`,
        {
          page: 1,
          limit: 100,
        },
      );

      setAttendanceRecords(records);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to load attendance records.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  loadAttendance();
}, [user?.email]);

  const currentMonth = new Date();

  const currentMonthRecords = attendanceRecords.filter(
    (record) => {
      const recordDate = new Date(record.date);

      return (
        recordDate.getMonth() === currentMonth.getMonth() &&
        recordDate.getFullYear() === currentMonth.getFullYear()
      );
    },
  );

  const presentDays = currentMonthRecords.filter(
    (record) =>
      record.status.toLowerCase() === "present",
  ).length;

  const absentDays = currentMonthRecords.filter(
    (record) =>
      record.status.toLowerCase() === "absent",
  ).length;

  const lateDays = currentMonthRecords.filter(
    (record) =>
      record.status.toLowerCase() === "late",
  ).length;

  const leaveDays = currentMonthRecords.filter(
    (record) =>
      record.status.toLowerCase() === "on leave",
  ).length;

  const workingHours = currentMonthRecords.reduce(
    (total, record) =>
      total + (record.total_hours ?? 0),
    0,
  );const today = new Date();

    const todayRecord = attendanceRecords.find((record) => {
    const recordDate = new Date(record.date);

    return (
        recordDate.getDate() === today.getDate() &&
        recordDate.getMonth() === today.getMonth() &&
        recordDate.getFullYear() === today.getFullYear()
    );
    });

    function formatTime(value: string | null) {
    if (!value) {
        return "--";
    }

    return new Date(value).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
    });
    }

    const todayStatus = todayRecord?.status || "Not Marked";

    const isCurrentlyAtWork =
    Boolean(todayRecord?.check_in) &&
    !todayRecord?.check_out;



  return (
    <div className="min-h-screen bg-[#f7f9f8] text-[#17213a]">

      {/* =========================================================
          TOP NAVIGATION
      ========================================================= */}
      <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-gray-200 bg-white px-6 lg:px-8">

        <div className="flex items-center gap-4">

          {/* Menu */}
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            <span className="text-2xl">☰</span>
          </button>

          <div>
            <p className="text-lg font-bold text-[#17213a]">
              Attendance
            </p>

            <p className="text-xs text-gray-500">
              Track your attendance and working hours
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">

          {/* Notifications */}
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-100"
            aria-label="Notifications"
          >
            <span className="text-xl">♧</span>

            <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          {/* User */}
          <div className="hidden items-center gap-3 sm:flex">

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dce5df] text-sm font-bold text-[#456b54]">
              {initials || "E"}
            </div>

            <div className="max-w-[150px]">
              <p className="truncate text-sm font-semibold text-gray-800">
                {employeeName}
              </p>

              <p className="truncate text-xs text-gray-500">
                Employee ID: {user?.id || "N/A"}
              </p>
            </div>

          </div>
        </div>
      </header>

      <div className="flex">

        {/* =========================================================
            SIDEBAR
        ========================================================= */}
        <aside className="hidden min-h-[calc(100vh-76px)] w-[250px] shrink-0 border-r border-gray-200 bg-white px-4 py-6 lg:flex lg:flex-col">

          {/* Branding */}
          <div className="mb-8 px-3">
            <h1 className="text-2xl font-bold text-[#456b54]">
              HRMS
            </h1>

            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-gray-500">
              Employee Portal
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-1">

            {/* Dashboard */}
            <button
              type="button"
              onClick={() =>
                navigate("/employee/dashboard")
              }
              className="flex h-11 items-center gap-3 rounded-xl px-4 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              <span className="w-5 text-center text-lg">
                ▦
              </span>

              Dashboard
            </button>

            {/* My Profile */}
            <button
              type="button"
              onClick={() =>
                navigate("/employee/profile")
              }
              className="flex h-11 items-center gap-3 rounded-xl px-4 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              <span className="w-5 text-center text-lg">
                ♙
              </span>

              My Profile
            </button>

            {/* Attendance */}
            <button
                type="button"
                onClick={() =>
                    navigate("/employee/attendance")
                }
                className="flex h-11 items-center gap-3 rounded-xl bg-[#5f806b] px-4 text-left text-sm font-semibold text-white"
                >
                <span className="w-5 text-center text-lg">
                    ✓
                </span>

                Attendance
            </button>

            {/* Remaining Navigation */}
            {[
              ["Leave", "◷"],
              ["Payroll", "▣"],
              ["My Documents", "▤"],
              ["My Assets", "▥"],
              ["Performance", "⌁"],
              ["Training", "◇"],
              ["Announcements", "◉"],
              ["Help & Support", "?"],
            ].map(([label, icon]) => (
              <button
                key={label}
                type="button"
                className="flex h-11 items-center gap-3 rounded-xl px-4 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                <span className="w-5 text-center text-lg">
                  {icon}
                </span>

                {label}
              </button>
            ))}
          </nav>

          {/* Employee Profile / Logout */}
          <div className="mt-auto border-t border-gray-100 pt-5">

            <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dce5df] text-sm font-bold text-[#456b54]">
                {initials || "E"}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-800">
                  {employeeName}
                </p>

                <p className="truncate text-xs text-gray-500">
                  Employee
                </p>
              </div>

            </div>

            <button
              type="button"
              onClick={onLogout}
              className="mt-3 flex h-11 w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-medium text-gray-600 transition hover:bg-red-50 hover:text-red-600"
            >
              <span className="w-5 text-center text-lg">
                ↪
              </span>

              Logout
            </button>

          </div>
        </aside>

        {/* =========================================================
            MAIN CONTENT
        ========================================================= */}
        <main className="min-w-0 flex-1 p-6 lg:p-8">

          {/* Page Header */}
          <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

            <div>
              <h1 className="text-2xl font-bold text-[#17213a]">
                Attendance
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Track your attendance, working hours, and daily records.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">

              <button
                type="button"
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-[#5f806b] hover:bg-[#f5f8f5]"
              >
                Attendance Calendar
              </button>

              <button
                type="button"
                className="rounded-xl bg-[#456b54] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#385b46]"
              >
                Download Report
              </button>

            </div>
          </section>

          {/* =====================================================
              MONTHLY SUMMARY
          ===================================================== */}
          <section className="mt-6">

            {isLoading && (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <p className="text-sm text-gray-500">
                  Loading attendance...
                </p>
              </div>
            )}

            {!isLoading && error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
                <p className="text-sm font-semibold text-red-700">
                  Unable to load attendance
                </p>

                <p className="mt-1 text-sm text-red-600">
                  {error}
                </p>
              </div>
            )}

            {!isLoading && !error && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

                {/* Present */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

                  <p className="text-sm font-medium text-gray-500">
                    Present Days
                  </p>

                  <div className="mt-3 flex items-end justify-between">

                    <p className="text-2xl font-bold text-[#17213a]">
                      {presentDays}
                    </p>

                    <span className="text-xs font-medium text-gray-400">
                      this month
                    </span>

                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">

                    <div
                      className="h-full rounded-full bg-[#5f806b]"
                      style={{
                        width: `${Math.min(
                          (presentDays /
                            Math.max(
                              currentMonthRecords.length,
                              1,
                            )) *
                            100,
                          100,
                        )}%`,
                      }}
                    />

                  </div>

                  <p className="mt-2 text-xs text-gray-400">
                    {currentMonthRecords.length} recorded days
                  </p>

                </div>

                {/* Absent */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

                  <p className="text-sm font-medium text-gray-500">
                    Absent Days
                  </p>

                  <p className="mt-3 text-2xl font-bold text-[#17213a]">
                    {absentDays}
                  </p>

                  <p className="mt-2 text-xs text-gray-400">
                    Recorded absences
                  </p>

                </div>

                {/* Late */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

                  <p className="text-sm font-medium text-gray-500">
                    Late Days
                  </p>

                  <p className="mt-3 text-2xl font-bold text-[#17213a]">
                    {lateDays}
                  </p>

                  <p className="mt-2 text-xs text-gray-400">
                    Late clock-ins
                  </p>

                </div>

                {/* Leave */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

                  <p className="text-sm font-medium text-gray-500">
                    On Leave
                  </p>

                  <p className="mt-3 text-2xl font-bold text-[#17213a]">
                    {leaveDays}
                  </p>

                  <p className="mt-2 text-xs text-gray-400">
                    Approved leave records
                  </p>

                </div>

                {/* Working Hours */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

                  <p className="text-sm font-medium text-gray-500">
                    Working Hours
                  </p>

                  <p className="mt-3 text-2xl font-bold text-[#17213a]">
                    {workingHours.toFixed(1)}h
                  </p>

                  <p className="mt-2 text-xs text-gray-400">
                    Total this month
                  </p>

                </div>

              </div>
            )}

          </section>

          {/* Footer */}
          <footer className="mt-8 border-t border-gray-200 py-6 text-center text-xs text-gray-400">
            © 2026 HRMS. All rights reserved. · Employee Portal
          </footer>

          {/* =========================================================
            TODAY'S ATTENDANCE & LEAVE BALANCE
        ========================================================= */}
        <section className="mt-6 grid gap-6 lg:grid-cols-2">

        {/* Today's Attendance */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

            <div className="flex items-start justify-between">

            <div>
                <h2 className="text-lg font-bold text-[#17213a]">
                Today's Attendance
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                Your attendance status for today.
                </p>
            </div>

            <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isCurrentlyAtWork
                    ? "bg-green-100 text-green-700"
                    : todayRecord
                    ? "bg-[#eef3ef] text-[#456b54]"
                    : "bg-gray-100 text-gray-500"
                }`}
            >
                {isCurrentlyAtWork
                ? "Currently at work"
                : todayStatus}
            </span>

            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">

            {/* Check In */}
            <div className="rounded-xl bg-[#f7f9f8] p-4">

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Check In
                </p>

                <p className="mt-2 text-xl font-bold text-[#17213a]">
                {formatTime(todayRecord?.check_in ?? null)}
                </p>

            </div>

            {/* Check Out */}
            <div className="rounded-xl bg-[#f7f9f8] p-4">

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Check Out
                </p>

                <p className="mt-2 text-xl font-bold text-[#17213a]">
                {formatTime(todayRecord?.check_out ?? null)}
                </p>

            </div>

            </div>

            {/* Work Status */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-100 p-4">

            <div className="flex items-center gap-3">

                <span
                className={`h-3 w-3 rounded-full ${
                    isCurrentlyAtWork
                    ? "bg-green-500"
                    : todayRecord
                        ? "bg-gray-400"
                        : "bg-yellow-400"
                }`}
                />

                <div>
                <p className="text-sm font-semibold text-gray-800">
                    {isCurrentlyAtWork
                    ? "Currently at work"
                    : todayRecord
                        ? "Attendance recorded"
                        : "Attendance not marked"}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                    {todayRecord?.total_hours != null
                    ? `${todayRecord.total_hours.toFixed(1)} hours recorded`
                    : "No working hours recorded"}
                </p>
                </div>

            </div>

            <span className="rounded-lg bg-[#eef3ef] px-3 py-1 text-xs font-semibold text-[#456b54]">
                Office
            </span>

            </div>

        </div>

        {/* Leave Balance */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

            <div className="flex items-start justify-between">

            <div>
                <h2 className="text-lg font-bold text-[#17213a]">
                Leave Balance
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                Your available leave quotas.
                </p>
            </div>

            <button
                type="button"
                className="text-sm font-semibold text-[#456b54] hover:underline"
            >
                View All
            </button>

            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">

            {/* Casual Leave */}
            <div className="rounded-xl border border-gray-100 p-4">

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Casual Leave
                </p>

                <p className="mt-2 text-2xl font-bold text-[#17213a]">
                8
                </p>

                <p className="mt-1 text-xs text-gray-400">
                Days available
                </p>

            </div>

            {/* Sick Leave */}
            <div className="rounded-xl border border-gray-100 p-4">

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Sick Leave
                </p>

                <p className="mt-2 text-2xl font-bold text-[#17213a]">
                6
                </p>

                <p className="mt-1 text-xs text-gray-400">
                Days available
                </p>

            </div>

            {/* Earned Leave */}
            <div className="rounded-xl border border-gray-100 p-4">

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Earned Leave
                </p>

                <p className="mt-2 text-2xl font-bold text-[#17213a]">
                12
                </p>

                <p className="mt-1 text-xs text-gray-400">
                Days available
                </p>

            </div>

            {/* Comp Off */}
            <div className="rounded-xl border border-gray-100 p-4">

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Comp Off
                </p>

                <p className="mt-2 text-2xl font-bold text-[#17213a]">
                2
                </p>

                <p className="mt-1 text-xs text-gray-400">
                Days available
                </p>

            </div>

            </div>

        </div>

        </section>

        </main>
      </div>
    </div>
  );
}

export default EmployeeAttendance;