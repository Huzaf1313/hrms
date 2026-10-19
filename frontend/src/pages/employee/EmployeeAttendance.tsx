import { useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../../services/api";
import { formatShiftTime, shiftService } from "../../services/shiftService";
import { holidayService } from "../../services/holidayService";
import { employeeAttendance } from "../../services/attendanceService";
import type { EmployeeAttendanceRecord } from "../../types/attendance";
import type { Shift } from "../../types/shift";
import {
  HOLIDAY_STYLE,
  formatHolidayDate,
  type Holiday,
} from "../../types/holiday";
import { ChevronLeft, ChevronRight } from "lucide-react";

import EmployeeAttendanceRegularizationModal from "./EmployeeAttendanceRegularizationModal";

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
  first_name: string | null;
  last_name: string | null;
  work_location: string | null;
  }

/** This page talks to /employee-attendance/*, whose record shape differs from
 *  the admin one, so the shared employee type is aliased to keep the name used
 *  throughout the rest of the file. */
type AttendanceRecord = EmployeeAttendanceRecord;

function resolveCheckIn(
  record: AttendanceRecord | null | undefined,
): string | null {
  if (!record) return null;
  return record.in_time ?? record.check_in ?? null;
}

function resolveCheckOut(
  record: AttendanceRecord | null | undefined,
): string | null {
  if (!record) return null;
  return record.out_time ?? record.check_out ?? null;
}

/** "09:30 AM" or "18:30" or an ISO string -> minutes since midnight, or
 *  null when it cannot be read. ISO values are converted to IST because
 *  shift times are business-local. */
function clockMinutes(value: string | null | undefined): number | null {
  if (!value) return null;

  const text = value.trim();

  const ampm = text.match(/^(\d{1,2}):(\d{2})\s*([AP])M$/i);

  if (ampm) {
    let hours = parseInt(ampm[1], 10) % 12;

    if (ampm[3].toUpperCase() === "P") hours += 12;

    return hours * 60 + parseInt(ampm[2], 10);
  }

  const plain = text.match(/^(\d{1,2}):(\d{2})$/);

  if (plain) {
    return parseInt(plain[1], 10) * 60 + parseInt(plain[2], 10);
  }

  const parsed = new Date(text);

  if (Number.isNaN(parsed.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(parsed);

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? NaN);

  if (Number.isNaN(read("hour"))) return null;

  return read("hour") * 60 + read("minute");
}

interface RegularizationRequest {
  id: string;
  employee_id: string;
  attendance_id: string;
  date: string;
  issue_type: string;
  requested_check_in?: string | null;
  requested_check_out?: string | null;
  reason: string;
  status: string;
  requested_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at: string;
  updated_at: string;
}

type LeaveStatus = "Pending" | "Approved" | "Rejected";

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

interface BackendLeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  attachment_url?: string | null;
  created_at?: string;
  updated_at?: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  admin_note?: string | null;
}

interface LeaveListResponse {
  items: BackendLeaveRequest[];
}

/** "YYYY-MM-DD" from local parts, so it matches the backend's date strings
 *  without a timezone shifting the day. */
const getLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

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
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [isRegularizationModalOpen, setIsRegularizationModalOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [regularizationRequests, setRegularizationRequests] = useState<RegularizationRequest[]>([]);
  const [myShift, setMyShift] = useState<Shift | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  /** The month the attendance calendar is showing. Everything in the calendar
   *  section follows this; today's punch card and history stay pinned to today. */
  const [viewMonth, setViewMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  /** Punches scoped to viewMonth, fetched separately so the history list above
   *  can keep its own unfiltered window. */
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);

  /** Which range monthRecords actually holds. Loading is derived from whether
   *  this still matches the range on screen, so it cannot fall out of step with
   *  the request the way a separate loading flag would. */
  const [loadedRange, setLoadedRange] = useState<{
    start: string;
    end: string;
  } | null>(null);

  const viewYear = viewMonth.getFullYear();
  const viewMonthIndex = viewMonth.getMonth();

  /** "YYYY-MM-DD" for the first and last day of the month being viewed. */
  const viewRange = useMemo(
    () => ({
      start: getLocalDateKey(new Date(viewYear, viewMonthIndex, 1)),
      end: getLocalDateKey(new Date(viewYear, viewMonthIndex + 1, 0)),
    }),
    [viewYear, viewMonthIndex],
  );

useEffect(() => {
  shiftService
    .myShift()
    .then(setMyShift)
    .catch(() => setMyShift(null));
}, []);

  // Refetched whenever the viewed month changes. Kept separate from the main
  // load so the calendar can page without reloading leave and regularization.
  useEffect(() => {
    if (!user?.employee_id) return;

    let isCurrent = true;

    employeeAttendance
      .month(user.employee_id, viewRange.start, viewRange.end)
      .then((records) => {
        if (!isCurrent) return;

        setMonthRecords(records);
        setLoadedRange({ start: viewRange.start, end: viewRange.end });
      })
      .catch(() => {
        // A failed month load must not wipe the calendar outright, but the
        // range still counts as resolved so the arrows stop spinning.
        if (!isCurrent) return;

        setMonthRecords([]);
        setLoadedRange({ start: viewRange.start, end: viewRange.end });
      });

    return () => {
      isCurrent = false;
    };
  }, [user?.employee_id, viewRange.start, viewRange.end]);

  /** True while viewing the month today falls in. Used to decide whether a
   *  punch belongs in the calendar, not to gate navigation. */
  const isViewingCurrentMonth =
    viewYear === new Date().getFullYear() &&
    viewMonthIndex === new Date().getMonth();

  // Treated as not-loading when there is no employee to fetch for, otherwise a
  // missing employee_id would leave loadedRange null forever and strand both
  // arrows in a permanently disabled state.
  const isMonthLoading =
    Boolean(user?.employee_id) &&
    (loadedRange?.start !== viewRange.start ||
      loadedRange?.end !== viewRange.end);

  function shiftMonth(amount: number) {
    setViewMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1),
    );
  }
  
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
  setError("Employee ID could not be found for the logged-in user.");
  return;
}

setEmployeeId(user.employee_id);

const [records, leaveList, requests, holidayList] = await Promise.all([
  api.get<AttendanceRecord[]>(
    `/employee-attendance/employees/${user.employee_id}`,
    {
      page: 1,
      limit: 100,
    },
  ),

  api.get<LeaveListResponse>(
    `/employee-leave/employees/${user.employee_id}`,
    {
      page: 1,
      limit: 100,
    },
  ),

  api.get<RegularizationRequest[]>(
    `/employees/${user.employee_id}/attendance/regularization`,
    {
      page: 1,
      limit: 100,
    },
  ),

  // Holidays are org-wide, so the whole set is small enough to fetch once.
  // A failure here must not fail the attendance load, hence its own fallback.
  holidayService.list().catch(() => [] as Holiday[]),
]);

// console.log("ATTENDANCE RECORDS:", records);
// console.log(
//   "TODAY:",
//   new Date().toString(),
//   new Date().toISOString(),
// );
// console.log("LEAVE DATA:", leaveList.items);



setAttendanceRecords(records);
setRegularizationRequests(requests);
setHolidays(holidayList);

setLeaveRequests(
  leaveList.items.map((leave) => ({
    id: leave.id,
    dateApplied: leave.created_at ?? "",
    leaveType: leave.leave_type,
    from: leave.start_date,
    to: leave.end_date,
    duration: 0,
    status:
      leave.status.toLowerCase() === "approved"
        ? "Approved"
        : leave.status.toLowerCase() === "rejected"
          ? "Rejected"
          : "Pending",
    reason: leave.reason,
    attachmentUrl: leave.attachment_url ?? null,
    requestedAt: leave.created_at ?? "",
    reviewedAt: leave.reviewed_at ?? null,
    reviewedBy: leave.reviewed_by ?? null,
    adminNote: leave.admin_note ?? null,
  })),
);

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

useEffect(() => {
  const interval = window.setInterval(() => {
    setCurrentTime(new Date());
  }, 60_000);

  return () => {
    window.clearInterval(interval);
  };
}, []);

const getISTDateParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
};

const currentTimeIST = getISTDateParts(currentTime);

const todayDateKey = `${currentTimeIST.year}-${String(
  currentTimeIST.month,
).padStart(2, "0")}-${String(
  currentTimeIST.day,
).padStart(2, "0")}`;

const today = currentTime;

const monthEndOfViewMonth = new Date(viewYear, viewMonthIndex + 1, 0);
monthEndOfViewMonth.setHours(0, 0, 0, 0);

// The calendar and every stat below it read the viewed month's records, which
// the month effect fetches on demand. `attendanceRecords` stays as the unpaged
// recent window used by the history list and today's punch card.
const currentMonthRecords = monthRecords;

const approvedLeaveDates = new Set<string>();

leaveRequests
  .filter(
    (leave) =>
      leave.status === "Approved",
  )
  .forEach((leave) => {
    const start = new Date(leave.from);
    const end = new Date(leave.to);

    const current = new Date(start);
    current.setHours(0, 0, 0, 0);

    const endDate = new Date(end);
    endDate.setHours(0, 0, 0, 0);

    while (current <= endDate) {
      // Scoped to the month on screen, so approved leave still resolves when
      // the employee pages back to an earlier month.
      if (
        current.getMonth() === viewMonthIndex &&
        current.getFullYear() === viewYear
      ) {
        approvedLeaveDates.add(
          `${current.getFullYear()}-${String(
            current.getMonth() + 1,
          ).padStart(2, "0")}-${String(
            current.getDate(),
          ).padStart(2, "0")}`,
        );
      }

      current.setDate(current.getDate() + 1);
    }
  });

// Holidays are keyed by the same "YYYY-MM-DD" the calendar cells build above,
// so both sides compare as plain strings. A date can hold more than one
// holiday, so each entry is a list.
const holidaysByDate = new Map<string, Holiday[]>();

holidays.forEach((holiday) => {
  const existing = holidaysByDate.get(holiday.date);

  if (existing) {
    existing.push(holiday);
  } else {
    holidaysByDate.set(holiday.date, [holiday]);
  }
});

const holidayDates = new Set(holidaysByDate.keys());

const presentDays = currentMonthRecords.filter(
  (record) => {
    const status = record.status.toLowerCase();

    return (
      status === "present" ||
      status === "late"
    );
  },
).length;

const lateDays = currentMonthRecords.filter(
  (record) => {
    if (!resolveCheckIn(record)) {
      return false;
    }

    // Prefer the server's measurement, which is taken against the employee's
    // real shift. Fall back to comparing shift start against check-in for
    // records that predate lateness tracking.
    if (record.late_minutes !== null && record.late_minutes !== undefined) {
      return record.late_minutes > 0;
    }

    if (record.is_late) {
      return true;
    }

    const checkInMinutes = clockMinutes(resolveCheckIn(record));
    const shiftStartMinutes = clockMinutes(
      record.shift_start ?? myShift?.start_time ?? null,
    );

    if (checkInMinutes === null || shiftStartMinutes === null) {
      return false;
    }

    return checkInMinutes > shiftStartMinutes;
  },
).length;

const totalOvertimeMinutes = currentMonthRecords.reduce(
  (sum, record) => sum + (record.overtime_minutes ?? 0),
  0,
);

const overtimeDays = currentMonthRecords.filter(
  (record) => (record.overtime_minutes ?? 0) > 0,
).length;

const leaveDays = approvedLeaveDates.size;

const attendanceDates = new Set(
  currentMonthRecords.map((record) => {
    const date = new Date(record.date);

    // If record.date is already YYYY-MM-DD,
    // keep it exactly as it is.
    if (/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
      return record.date;
    }

    return getLocalDateKey(date);
  }),
);

let absentDays = 0;

const monthStart = new Date(viewYear, viewMonthIndex, 1);

const currentDay = new Date(monthStart);
currentDay.setHours(0, 0, 0, 0);

const todayOnly = new Date(today);
todayOnly.setHours(0, 0, 0, 0);

// Days only count as absent once they have happened. Stops at today for the
// current month, and at the last day of the month for any earlier one.
const lastCountableDay =
  todayOnly < monthEndOfViewMonth ? todayOnly : monthEndOfViewMonth;

while (currentDay <= lastCountableDay) {
  const dayOfWeek = currentDay.getDay();

  const isWeekday =
    dayOfWeek !== 0 &&
    dayOfWeek !== 6;

  const dateKey = getLocalDateKey(currentDay);

  // A holiday is a non-working day, so it never counts against the employee.
  if (
    isWeekday &&
    !attendanceDates.has(dateKey) &&
    !approvedLeaveDates.has(dateKey) &&
    !holidayDates.has(dateKey)
  ) {
    absentDays += 1;
  }

  currentDay.setDate(
    currentDay.getDate() + 1,
  );
}

const completedWorkingHours =
  currentMonthRecords.reduce(
    (total, record) =>
      total + (record.total_hours ?? 0),
    0,
  );

const todayRecordForHours =
  currentMonthRecords.find(
    (record) => record.date === todayDateKey,
  );

let workingHours = completedWorkingHours;

if (
  resolveCheckIn(todayRecordForHours) &&
  !resolveCheckOut(todayRecordForHours)
) {
  // The live check-in value can be a display string ("09:30 AM") or an ISO
  // timestamp, depending on whether the record came from a reload or a fresh
  // punch. Only the ISO form can be turned into an elapsed duration.
  const checkIn = new Date(todayRecordForHours!.check_in ?? "");

  if (!Number.isNaN(checkIn.getTime())) {
    const liveHours =
      (today.getTime() - checkIn.getTime()) /
      (1000 * 60 * 60);

    workingHours += Math.max(liveHours, 0);
  }
}

    const todayRecord = attendanceRecords.find(
      (record) => record.date === todayDateKey,
    );

    const calendarYear = viewYear;
    const calendarMonth = viewMonthIndex;

    const monthName = viewMonth.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });

    const firstDayOfMonth = new Date(
      calendarYear,
      calendarMonth,
      1,
    ).getDay();

    const daysInMonth = new Date(
      calendarYear,
      calendarMonth + 1,
      0,
    ).getDate();

    const calendarDays = Array.from(
      { length: firstDayOfMonth + daysInMonth },
      (_, index) => {
        if (index < firstDayOfMonth) {
          return null;
        }

        return index - firstDayOfMonth + 1;
      },
    );

    function getAttendanceForDay(day: number) {
      return monthRecords.find((record) => {
        const recordDate = new Date(record.date);

        return (
          recordDate.getDate() === day &&
          recordDate.getMonth() === calendarMonth &&
          recordDate.getFullYear() === calendarYear
        );
      });
    }

    function formatTime(value: string | null) {
  if (!value) return "--";

  const text = value.trim();

  // Already a display string such as "09:30 AM" or "18:30"
  if (/^\d{1,2}:\d{2}(\s*[AP]M)?$/i.test(text)) {
    return text;
  }

  // ISO timestamp; assume UTC when no timezone is present
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(text);
  const date = new Date(hasTz ? text : `${text}Z`);

  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

    const todayStatus = todayRecord?.status || "Not Marked";

    const isCurrentlyAtWork =
    Boolean(resolveCheckIn(todayRecord)) &&
    !resolveCheckOut(todayRecord);

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
            "/employee-attendance",
            {
                employee_id: employeeId,
                date: getLocalDateKey(now),
                check_in: now.toISOString(),
                check_out: null,
                status: "Present",
                total_hours: null,
            },
            );

            setAttendanceRecords((records) => [
            attendance,
            ...records,
            ]);

            // A punch always lands on today, so the calendar only needs it when
            // today is inside the month on screen.
            if (isViewingCurrentMonth) {
            setMonthRecords((records) => [
            attendance,
            ...records,
            ]);
            }
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

            if (!resolveCheckIn(todayRecord)) {
                setActionError(
                "Check-in time is missing for today's attendance.",
                );
                return;
            }

            if (resolveCheckOut(todayRecord)) {
                setActionError(
                "You have already checked out for today.",
                );
                return;
            }

            try {
                setIsActionLoading(true);
                setActionError(null);

                const checkOutTime = new Date();

                // total_hours is intentionally not sent: the backend measures
                // worked time and overtime from the real shift, and stays
                // authoritative for overnight punches.
                const attendance = await api.put<AttendanceRecord>(
                `/employee-attendance/${todayRecord.id}`,
                {
                    check_out: checkOutTime.toISOString(),
                },
                );

                setAttendanceRecords((records) =>
                records.map((record) =>
                    record.id === attendance.id
                    ? attendance
                    : record,
                ),
                );

                if (isViewingCurrentMonth) {
                setMonthRecords((records) =>
                records.map((record) =>
                    record.id === attendance.id
                    ? attendance
                    : record,
                ),
                );
                }
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

          function formatDuration(totalHours: number | null) {
            if (totalHours == null) {
              return "--";
            }

            const hours = Math.floor(totalHours);
            const minutes = Math.round((totalHours - hours) * 60);

            return `${hours}h ${minutes}m`;
          }

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
            </div>
          </section>

          {/* =====================================================
              MONTHLY SUMMARY
          ===================================================== */}
          <section className="mt-6">

            {isLoading && (
              <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">

                {/* Present */}
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
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
                            presentDays +
                              absentDays +
                              leaveDays,
                            1,
                          )) *
                          100,
                        100,
                      )}%`,
                    }}
                  />
                </div>

                <p className="mt-2 text-xs text-gray-400">
                  {presentDays} of{" "}
                  {presentDays + absentDays + leaveDays}{" "}
                  working days
                </p>
              </div>


                {/* Absent */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">

                  <p className="text-sm font-medium text-gray-500">
                    Absent Days
                  </p>

                  <p className="mt-3 text-2xl font-bold text-[#17213a]">
                    {absentDays}
                  </p>
                </div>

                {/* Late */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">

                  <p className="text-sm font-medium text-gray-500">
                    Late Days
                  </p>

                  <p className="mt-3 text-2xl font-bold text-[#17213a]">
                    {lateDays}
                  </p>
                </div>

                {/* Overtime */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">

                  <p className="text-sm font-medium text-gray-500">
                    Overtime
                  </p>

                  <p className="mt-3 text-2xl font-bold text-amber-600">
                    {totalOvertimeMinutes > 0
                      ? formatDuration(totalOvertimeMinutes / 60)
                      : "0h"}
                  </p>

                  <p className="mt-2 text-xs text-gray-400">
                    {overtimeDays} day
                    {overtimeDays === 1 ? "" : "s"} this month
                  </p>

                </div>

                {/* Leave */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">

                  <p className="text-sm font-medium text-gray-500">
                    On Leave
                  </p>

                  <p className="mt-3 text-2xl font-bold text-[#17213a]">
                    {leaveDays}
                  </p>
                </div>

                {/* Working Hours */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">

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

          {/* =========================================================
            TODAY'S ATTENDANCE & LEAVE BALANCE
        ========================================================= */}
        <section className="mt-6 grid gap-6 lg:grid-cols-2">

        {/* Today's Attendance */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">

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
                {formatTime(resolveCheckIn(todayRecord) ?? null)}
                </p>

            </div>

            {/* Check Out */}
            <div className="rounded-xl bg-[#f5f7fb] p-4">

                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Check Out
                </p>

                <p className="mt-2 text-xl font-bold text-[#17213a]">
                {formatTime(resolveCheckOut(todayRecord) ?? null)}
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
                            ) : !resolveCheckOut(todayRecord) ? (
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

                {/* Shift & Workplace Info */}
                  <div className="mt-5 border-t border-gray-100 pt-4">
                    <div className="flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="font-semibold text-gray-600">
                          {myShift?.name ?? todayRecord?.shift ?? "No"} Shift:
                        </span>{" "}
                        {myShift
                          ? `${formatShiftTime(myShift.start_time)} – ${formatShiftTime(
                              myShift.end_time,
                            )}${
                              myShift.is_overnight
                                ? " (ends next day)"
                                : ""
                            }`
                          : "No shift assigned"}
                      </div>

                      {todayRecord && (todayRecord.overtime_minutes ?? 0) > 0 && (
                        <div>
                          <span className="font-semibold text-amber-600">
                            Overtime today:
                          </span>{" "}
                          {todayRecord.overtime_display}
                        </div>
                      )}

                      <div>
                        <span className="font-semibold text-gray-600">
                          Workplace:
                        </span>{" "}
                        {user?.work_location ?? "Main Office"}
                      </div>

                    </div>
                  </div>
        </div>

        {/* Leave Balance */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">

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

        {/* =========================================================
            PUNCH HISTORY & REGULARIZATION
        ========================================================= */}
        <section className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">

          {/* Punch In/Out History */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">

            <div className="flex items-start justify-between">

              <div>
                <h2 className="text-lg font-bold text-[#17213a]">
                  Punch In/Out History
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Your recent daily punch records.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAllHistory((prev) => !prev)}
                className="text-sm font-semibold text-[#2563eb] hover:underline"
              >
                {showAllHistory
                  ? "Show Recent History"
                  : "View All History"}
              </button>

            </div>

            <div className="mt-6 space-y-3">

              {attendanceRecords.length === 0 ? (

                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                  <p className="text-sm font-medium text-gray-500">
                    No attendance records found.
                  </p>
                </div>

              ) : (

                attendanceRecords
                  .slice(
                    0,
                    showAllHistory
                      ? attendanceRecords.length
                      : 5,
                  )
                  .map((record) => {

                    const recordDate = new Date(record.date);

                    const formattedDate =
                      recordDate.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      });

                    return (
                      <div
                        key={record.id}
                        className="rounded-xl border border-gray-100 p-4"
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div>
                            <p className="text-sm font-semibold text-[#17213a]">
                              {formattedDate}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              Check-In:{" "}
                              {resolveCheckIn(record)
                                ? formatTime(resolveCheckIn(record))
                                : "--"}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              Check-Out:{" "}
                              {resolveCheckOut(record)
                                ? formatTime(resolveCheckOut(record))
                                : "--"}
                            </p>

                            <p className="mt-2 text-xs text-gray-400">
                              Shift:{" "}
                              {record.shift_id ||
                              record.shift_duration_minutes != null
                                ? record.shift || "General"
                                : "No shift assigned"}
                            </p>

                            <p className="mt-1 text-xs text-gray-400">
                              Total Hours:{" "}
                              {formatDuration(record.total_hours)}
                            </p>

                            {(record.overtime_minutes ?? 0) > 0 && (
                              <p className="mt-1 text-xs font-semibold text-amber-600">
                                Overtime: {record.overtime_display}
                              </p>
                            )}
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                              record.status.toLowerCase() === "present"
                                ? "bg-green-100 text-green-700"
                                : record.status.toLowerCase() === "late"
                                  ? "bg-orange-100 text-orange-700"
                                  : record.status.toLowerCase() === "absent"
                                    ? "bg-red-100 text-red-700"
                                    : record.status.toLowerCase() === "on leave"
                                      ? "bg-purple-100 text-purple-700"
                                      : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {record.status}
                          </span>

                        </div>

                      </div>
                    );
                  })

              )}

            </div>

          </div>


          {/* Regularization Requests */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">

            <div className="flex items-start justify-between gap-4">

              <div>
                <h2 className="text-lg font-bold text-[#17213a]">
                  Regularization Requests
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Track your attendance regularization requests.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsRegularizationModalOpen(true)}
                className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
              >
                Submit Request
              </button>

            </div>


            {/* Request List */}
            <div className="mt-6 space-y-3">

              {regularizationRequests.length === 0 ? (

                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                  <p className="text-sm font-medium text-gray-500">
                    No regularization requests found.
                  </p>
                </div>

              ) : (

                regularizationRequests
                  .slice(
                    0,
                    showAllRequests
                      ? regularizationRequests.length
                      : 3,
                  )
                  .map((request) => {

                    const requestDate = new Date(request.date);

                    const formattedDate =
                      requestDate.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      });

                    const requestedDate =
                      new Date(
                        request.requested_at,
                      ).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      });

                    const status =
                      request.status.toLowerCase();

                    let statusClass =
                      "bg-yellow-100 text-yellow-700";

                    if (status === "approved") {
                      statusClass =
                        "bg-green-100 text-green-700";
                    } else if (status === "rejected") {
                      statusClass =
                        "bg-red-100 text-red-700";
                    }

                    return (
                      <div
                        key={request.id}
                        className="rounded-xl border border-gray-100 p-4"
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div>
                            <p className="text-sm font-semibold text-[#17213a]">
                              {formattedDate}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              {request.issue_type}
                            </p>

                            <p className="mt-2 text-xs text-gray-400">
                              Requested on {requestedDate}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass}`}
                          >
                            {request.status}
                          </span>

                        </div>

                      </div>
                    );
                  })

              )}

            </div>


            {/* View All Requests */}
            {regularizationRequests.length > 3 && (
              <div className="mt-5 border-t border-gray-100 pt-4">

                <button
                  type="button"
                  onClick={() =>
                    setShowAllRequests(
                      (previous) => !previous,
                    )
                  }
                  className="text-sm font-semibold text-[#2563eb] hover:underline"
                >
                  {showAllRequests
                    ? "Show Recent Requests"
                    : "View All Requests"}
                </button>

              </ div>
            )}

          </div>

        </section>

        {/* =========================================================
            TODAY'S TIMELINE
        ========================================================= */}
        <section className="mt-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

            <div>
              <h2 className="text-lg font-bold text-[#17213a]">
                Today's Timeline
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Your punch-in and punch-out activity for today.
              </p>
            </div>

            <div className="mt-6 space-y-6">

              {/* Check-In */}
              <div className="flex items-start gap-4">

                <div className="relative flex flex-col items-center">
                  <span
                    className={`h-4 w-4 rounded-full ring-4 ${
                      resolveCheckIn(todayRecord)
                        ? "bg-green-500 ring-green-100"
                        : "bg-gray-300 ring-gray-100"
                    }`}
                  />

                  <span className="mt-1 h-12 w-px bg-gray-200" />
                </div>

                <div className="flex-1">
                  <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        Check-In
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        {resolveCheckIn(todayRecord)
                          ? formatTime(resolveCheckIn(todayRecord))
                          : "--:-- --"}
                      </p>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                        resolveCheckIn(todayRecord)
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {resolveCheckIn(todayRecord)
                        ? "Web Portal"
                        : "Not yet punched in"}
                    </span>
                  </div>
                </div>

              </div>

              {/* Check-Out */}
              <div className="flex items-start gap-4">

                <div className="flex flex-col items-center">
                  <span
                    className={`h-4 w-4 rounded-full ring-4 ${
                      resolveCheckOut(todayRecord)
                        ? "bg-green-500 ring-green-100"
                        : "bg-gray-300 ring-gray-100"
                    }`}
                  />
                </div>

                <div className="flex-1">
                  <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        Check-Out
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        {resolveCheckOut(todayRecord)
                          ? formatTime(resolveCheckOut(todayRecord))
                          : "--:-- --"}
                      </p>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                        resolveCheckOut(todayRecord)
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {resolveCheckOut(todayRecord)
                        ? "Web Portal"
                        : "Not yet punched out"}
                    </span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </section>

        {/* =========================================================
            ATTENDANCE OVERVIEW
        ========================================================= */}
        <section className="mt-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

            <div>
              <h2 className="text-lg font-bold text-[#17213a]">
                Attendance Overview
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Monthly attendance calendar.
              </p>
            </div>

            {/* Month Header */}
            <div className="mt-6 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#17213a]">
                {monthName}
              </h3>

              <div className="flex items-center gap-1">
                {isMonthLoading && (
                  <span className="mr-1 text-xs text-gray-400">
                    Loading...
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  disabled={isMonthLoading}
                  className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  disabled={isMonthLoading}
                  className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Calendar */}
            <div className="mt-5 overflow-x-auto">

              <div className="min-w-[600px]">

                {/* Week Days */}
                <div className="grid grid-cols-7 border-b border-gray-100 pb-3">

                  {[
                    "Sun",
                    "Mon",
                    "Tue",
                    "Wed",
                    "Thu",
                    "Fri",
                    "Sat",
                  ].map((day) => (
                    <div
                      key={day}
                      className="text-center text-xs font-semibold uppercase tracking-wide text-gray-400"
                    >
                      {day}
                    </div>
                  ))}

                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7">

                  {calendarDays.map((day, index) => {

                    if (day === null) {
                      return (
                        <div
                          key={`empty-${index}`}
                          className="h-20 border-b border-r border-gray-100"
                        />
                      );
                    }

                    const attendance = getAttendanceForDay(day);

                    const isToday =
                      day === today.getDate() &&
                      calendarMonth === today.getMonth() &&
                      calendarYear === today.getFullYear();

                    const dateKey = `${calendarYear}-${String(
                      calendarMonth + 1,
                    ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                    const calendarDate = new Date(
                      calendarYear,
                      calendarMonth,
                      day,
                    );

                    const dayOfWeek = calendarDate.getDay();

                    const isWeeklyOff =
                      dayOfWeek === 0 || dayOfWeek === 6;

                    const isOnLeave =
                      approvedLeaveDates.has(dateKey);

                    const dayHolidays =
                      holidaysByDate.get(dateKey) ?? [];

                    // A day that has not happened yet has no attendance to
                    // judge. Without this it falls through to "no record" and
                    // paints red, which reads as absent when it is really just
                    // in the future.
                    const isFuture = calendarDate > todayOnly;

                    const status =
                      attendance?.status?.toLowerCase();

                    const isLate = (() => {
                        if (!attendance || !resolveCheckIn(attendance)) return false;

                        if (attendance.late_minutes != null) return attendance.late_minutes > 0;
                        if (attendance.is_late) return true;

                        const inMin = clockMinutes(resolveCheckIn(attendance));
                        const startMin = clockMinutes(
                          attendance.shift_start ?? myShift?.start_time ?? null,
                        );

                        return inMin !== null && startMin !== null && inMin > startMin;
                      })();

                    let statusClass = "text-gray-700";

                    // Weekly off is checked first on purpose: a holiday that
                    // lands on a Saturday or Sunday stays grey, since the day is
                    // already a non-working day either way.
                    if (isWeeklyOff) {
                      statusClass =
                        "bg-gray-200 text-gray-600";
                    } else if (dayHolidays.length > 0) {
                      // Ahead of the holiday, since one can be published before
                      // it arrives.
                      statusClass = HOLIDAY_STYLE;
                    } else if (isFuture) {
                      statusClass = "text-gray-400";
                    } else if (isOnLeave) {
                      statusClass =
                        "bg-purple-100 text-purple-700";
                    } else if (isLate) {
                      statusClass =
                        "bg-orange-100 text-orange-700";
                    } else if (status === "present") {
                      statusClass =
                        "bg-green-100 text-green-700";
                    } else if (status === "absent") {
                      statusClass =
                        "bg-red-100 text-red-700";
                    } else if (!attendance) {
                      statusClass =
                        "bg-red-100 text-red-700";
                    }

                    // Named only on working days, to match the grey weekend
                    // cells above.
                    const showHolidayName =
                      !isWeeklyOff && dayHolidays.length > 0;

                    const holidayTitle = showHolidayName
                      ? dayHolidays
                          .map(
                            (holiday) =>
                              `${holiday.name}: ${holiday.description ?? formatHolidayDate(holiday.date)}`,
                          )
                          .join(" | ")
                      : undefined;

                    return (
                      <div
                        key={day}
                        className="flex h-20 flex-col items-center justify-center gap-1 border-b border-r border-gray-100 px-1"
                        title={holidayTitle}
                      >

                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                            isToday
                              ? "bg-[#2563eb] text-white"
                              : statusClass
                          }`}
                        >
                          {day}
                        </div>

                        {showHolidayName && (
                          <span className="flex w-full items-center justify-center gap-0.5">
                            <span className="truncate text-[10px] font-medium text-teal-700">
                              {dayHolidays[0].name}
                            </span>

                            {dayHolidays.length > 1 && (
                              <span className="shrink-0 text-[10px] font-semibold text-teal-500">
                                +{dayHolidays.length - 1}
                              </span>
                            )}
                          </span>
                        )}

                      </div>
                    );
                  })}

                </div>

              </div>

            </div>

            {/* Legend */}
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3">

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-xs text-gray-500">
                  Present
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-orange-400" />
                <span className="text-xs text-gray-500">
                  Late
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-xs text-gray-500">
                  Absent
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-purple-500" />
                <span className="text-xs text-gray-500">
                  On Leave
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-gray-300" />
                <span className="text-xs text-gray-500">
                  Weekly Off
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-teal-500" />
                <span className="text-xs text-gray-500">
                  Holiday
                </span>
              </div>
            </div>
          </div>
        </section>
        <EmployeeAttendanceRegularizationModal
          isOpen={isRegularizationModalOpen}
          onClose={() => setIsRegularizationModalOpen(false)}
          attendanceRecords={attendanceRecords}
        />
        </main>
    </div>
  );
}
export default EmployeeAttendance;