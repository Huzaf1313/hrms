import { useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../../services/api";

interface User {
  id: string;
  employee_id: string;
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

function EmployeeAttendance() {
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


  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

useEffect(() => {
  async function loadAttendance() {
    if (!user?.employee_id) {
        setIsLoading(false);
        setError("Employee ID could not be found for the logged-in user.");
        return;
    }

    try {
      setIsLoading(true);
      setError(null);

if (!user.employee_id) {
  setEmployeeId(null);
  setError(
    "Employee ID could not be found for the logged-in user.",
  );
  return;
}

setEmployeeId(user.employee_id);

const records = await api.get<AttendanceRecord[]>(
  `/employees/${user.employee_id}/attendance`,
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
}, [user?.employee_id]);


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

        const utcValue = value.endsWith("Z")
            ? value
            : `${value}Z`;

        return new Date(utcValue).toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
        });
        }

    const todayStatus = todayRecord?.status || "Not Marked";

    const isCurrentlyAtWork =
    Boolean(todayRecord?.check_in) &&
    !todayRecord?.check_out;

    const handleCheckIn = async () => {
        if (!employeeId) {
            setActionError("Employee profile could not be found.");
            return;
        }

        if (todayRecord) {
            setActionError("Attendance has already been marked for today.");
            return;
        }

        try {
            setIsActionLoading(true);
            setActionError(null);

            const now = new Date();

            const attendance = await api.post<AttendanceRecord>(
            "/attendance",
            {
                employee_id: employeeId,
                date: now.toISOString().split("T")[0],
                check_in: now.toISOString(),
                check_out: null,
                status: "present",
                total_hours: null,
            },
            );

            setAttendanceRecords((records) => [
            attendance,
            ...records,
            ]);
        } catch (err) {
            if (err instanceof ApiError) {
            setActionError(err.message);
            } else {
            setActionError(
                "Unable to check in. Please try again.",
            );
            }
        } finally {
            setIsActionLoading(false);
        }
        };

        const handleCheckOut = async () => {
            if (!todayRecord) {
                setActionError(
                "You need to check in before checking out.",
                );
                return;
            }

            if (!todayRecord.check_in) {
                setActionError(
                "Check-in time is missing for today's attendance.",
                );
                return;
            }

            if (todayRecord.check_out) {
                setActionError(
                "You have already checked out for today.",
                );
                return;
            }

            try {
                setIsActionLoading(true);
                setActionError(null);

                const checkOutTime = new Date();
                const checkInRaw = todayRecord.check_in.endsWith("Z")
                  ? todayRecord.check_in
                  : `${todayRecord.check_in}Z`;
                const checkInTime = new Date(checkInRaw);

                const totalHours =
                (checkOutTime.getTime() - checkInTime.getTime()) /
                (1000 * 60 * 60);

                const attendance = await api.put<AttendanceRecord>(
                `/attendance/${todayRecord.id}`,
                {
                    check_out: checkOutTime.toISOString(),
                    total_hours: Number(totalHours.toFixed(2)),
                },
                );

                setAttendanceRecords((records) =>
                records.map((record) =>
                    record.id === attendance.id
                    ? attendance
                    : record,
                ),
                );
            } catch (err) {
                if (err instanceof ApiError) {
                setActionError(err.message);
                } else {
                setActionError(
                    "Unable to check out. Please try again.",
                );
                }
            } finally {
                setIsActionLoading(false);
            }
            };

  return (
    <div className="px-6 pb-10 pt-8 lg:px-8">
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
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-[#2563eb] hover:bg-[#f5f8f5]"
              >
                Attendance Calendar
              </button>

              <button
                type="button"
                className="rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
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
                      className="h-full rounded-full bg-[#2563eb]"
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
                    ? "bg-[#eef3ef] text-[#2563eb]"
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
            <div className="rounded-xl bg-[#f5f7fb] p-4">

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Check In
                </p>

                <p className="mt-2 text-xl font-bold text-[#17213a]">
                {formatTime(todayRecord?.check_in ?? null)}
                </p>

            </div>

            {/* Check Out */}
            <div className="rounded-xl bg-[#f5f7fb] p-4">

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Check Out
                </p>

                <p className="mt-2 text-xl font-bold text-[#17213a]">
                {formatTime(todayRecord?.check_out ?? null)}
                </p>

            </div>

            </div>

            {actionError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="text-sm font-medium text-red-700">
                    {actionError}
                    </p>
                </div>
                )}

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

            <span className="rounded-lg bg-[#eef3ef] px-3 py-1 text-xs font-semibold text-[#2563eb]">
                Office
            </span>

            </div>

                {/* Attendance Actions */}
                    <div className="mt-4">
                        {!todayRecord ? (
                             <button
                            type="button"
                             onClick={handleCheckIn}
                             disabled={isActionLoading}
                             className="w-full rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isActionLoading ? "Checking In..." : "Check In"}
                                </button>
                            ) : !todayRecord.check_out ? (
                                <button
                                type="button"
                                onClick={handleCheckOut}
                                disabled={isActionLoading}
                                className="w-full rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                {isActionLoading ? "Checking Out..." : "Check Out"}
                                </button>
                            ) : (
                                <div className="rounded-xl bg-[#eef3ef] px-4 py-3 text-center">
                                <p className="text-sm font-semibold text-[#2563eb]">
                                    Attendance Completed
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    You have checked in and checked out for today.
                                </p>
                                </div>
                            )}
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
                className="text-sm font-semibold text-[#2563eb] hover:underline"
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
  );
}

export default EmployeeAttendance;
