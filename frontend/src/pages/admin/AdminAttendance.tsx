import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserCheck,
  Clock,
  CalendarDays,
  UserX,
  Download,
  UserPlus,
  Search,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  FileText,
  ClipboardEdit,
  Users2,
  Timer,
  RotateCcw,
  MoreVertical,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { CardSkeleton, TableRowSkeleton } from "../../components/ui";
import { ApiError } from "../../services/api";
import { useGlobalDate } from "../../context/globalDateContext";
import { attendanceService } from "../../services/attendanceService";
import { formatShiftTime } from "../../services/shiftService";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDepartments } from "../../hooks/useDepartments";
import { useShifts } from "../../hooks/useShifts";
import { queryKeys } from "../../lib/queryKeys";
import type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummary,
} from "../../types/attendance";
import RegularizationRequestsCard from "../../components/admin/RegularizationRequestsCard";
import ShiftManagerModal from "../../components/admin/ShiftManagerModal";

const tabs = [
  { label: "All Employees", status: undefined as string | undefined },
  { label: "Present", status: "present" },
  { label: "Late", status: "late" },
  { label: "On Leave", status: "on_leave" },
  { label: "Absent", status: "absent" },
  { label: "Missing Punch", status: "missing_punch" },
];

const statusStyles: Record<AttendanceStatus, string> = {
  present: "bg-emerald-50 text-emerald-600",
  late: "bg-orange-50 text-orange-500",
  absent: "bg-rose-50 text-rose-600",
  on_leave: "bg-purple-50 text-purple-600",
  working: "bg-blue-50 text-blue-600",
  overtime: "bg-blue-50 text-blue-600",
  missing_punch: "bg-rose-50 text-rose-600",
};

const statusDot: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500",
  late: "bg-orange-500",
  absent: "bg-rose-500",
  on_leave: "bg-purple-500",
  working: "bg-blue-500",
  overtime: "bg-blue-500",
  missing_punch: "bg-rose-500",
};

/** Shared styling so every filter control has an identical height and focus
 *  treatment. h-10 also keeps the Overtime readout and Clear button aligned. */
const filterControlClass =
  "h-10 w-full rounded-full border border-gray-200 bg-white px-4 pr-9 text-sm " +
  "text-gray-700 transition hover:border-gray-300 " +
  "focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10";

const quickActions = [
  { label: "Mark Attendance", icon: UserPlus, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
  { label: "Process Regularization", icon: ClipboardEdit, iconBg: "bg-orange-50", iconColor: "text-orange-500" },
  { label: "Generate Report", icon: FileText, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  { label: "Manage Shifts", icon: Users2, iconBg: "bg-violet-50", iconColor: "text-violet-600" },
];

// --- Sorting -----------------------------------------------------------

type SortKey =
  | "employee"
  | "employee_id"
  | "department"
  | "shift"
  | "in_time"
  | "out_time"
  | "working_hours"
  | "status";

type SortDirection = "asc" | "desc";

const columns: { key: SortKey; label: string }[] = [
  { key: "employee", label: "Employee" },
  { key: "employee_id", label: "Employee ID" },
  { key: "department", label: "Department" },
  { key: "shift", label: "Shift" },
  { key: "in_time", label: "In Time" },
  { key: "out_time", label: "Out Time" },
  { key: "working_hours", label: "Working Hours" },
  { key: "status", label: "Status" },
];

/** "09:18 AM" -> minutes since midnight, for correctly ordering times.
 * Anything unparseable (missing punch, "--", etc.) sorts to the end. */
function timeToMinutes(value: string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;

  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match) return Number.POSITIVE_INFINITY;

  let hours = parseInt(match[1], 10) % 12;
  const minutes = parseInt(match[2], 10);
  if (match[3].toUpperCase() === "PM") hours += 12;

  return hours * 60 + minutes;
}

/** "9hr 14min" / "9h 14m" / "9H 14M" / numeric hours -> total minutes, for
 *  numeric ordering. Records predating overtime tracking have no
 *  worked_minutes, so the text form is still needed as a fallback. */
function workingHoursToMinutes(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return Number.NEGATIVE_INFINITY;
  }
  if (typeof value === "number") return value * 60;

  const match = value.match(/(\d+(?:\.\d+)?)\s*h(?:r)?(?:\s*(\d+)\s*m)?/i);
  if (!match) return Number.NEGATIVE_INFINITY;

  const hours = parseFloat(match[1]);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;

  return hours * 60 + minutes;
}

function getSortValue(row: AttendanceRecord, key: SortKey): string | number {
  switch (key) {
    case "employee":
      return `${row.employee.first_name} ${row.employee.last_name}`.toLowerCase();
    case "employee_id":
      return row.employee.employee_code?.toLowerCase() ?? "";
    case "department":
      return row.employee.department_name?.toLowerCase() ?? "";
    case "shift":
      return row.shift?.toLowerCase() ?? "";
    case "in_time":
      return timeToMinutes(row.in_time ?? row.check_in);
    case "out_time":
      return timeToMinutes(row.out_time ?? row.check_out);
    case "working_hours":
      // Prefer the numeric field: exact, and unaffected by display formatting.
      if (row.worked_minutes !== null && row.worked_minutes !== undefined) {
        return row.worked_minutes;
      }

      return workingHoursToMinutes(row.working_hours ?? row.total_hours);
    case "status":
      return row.status;
    default:
      return "";
  }
}

// -------------------------------------------------------------------------

function AttendanceDonut({ summary }: { summary: AttendanceSummary | null }) {
  const present = summary?.present_percentage ?? 0;
  const late = summary?.late_percentage ?? 0;
  const leave = summary?.on_leave_percentage ?? 0;
  const absent = summary?.absent_percentage ?? 0;
  const gradient = `conic-gradient(
    #10b981 0% ${present}%,
    #f97316 ${present}% ${present + late}%,
    #a855f7 ${present + late}% ${present + late + leave}%,
    #f43f5e ${present + late + leave}% ${present + late + leave + absent}%,
    #e5e7eb ${present + late + leave + absent}% 100%
  )`;

  return (
    <div className="relative flex h-40 w-40 items-center justify-center rounded-full">
      <div className="h-40 w-40 rounded-full" style={{ background: gradient }} />
      <div className="absolute flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white text-center">
        <span className="text-2xl font-bold text-gray-900">
          {summary?.total_employees ?? "-"}
        </span>
        <span className="text-xs text-gray-500">Total</span>
      </div>
    </div>
  );
}

/** The header date is already an ISO string, so it only needs reading out. */
function formatSelectedDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function displayPunchTime(value: string | null | undefined): string {
  if (!value) return "--";

  if (value.includes("T")) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString([], {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
  }

  return value;
}

function displayWorkingHours(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "--";
  return typeof value === "number" ? `${value}h` : value;
}

// The backend falls back to the label "General" when it cannot find a shift,
// so a shift name on its own proves nothing. Only a real shift reference means
// the day has a length to measure overtime against.
function hasShift(row: AttendanceRecord): boolean {
  return Boolean(row.shift_id) || row.shift_duration_minutes != null;
}

function displayShift(row: AttendanceRecord): string {
  if (!hasShift(row)) return "No shift";
  return row.shift || "General";
}

/** "9:30 AM - 6:30 PM" under the shift name, when the shift has times. */
function displayShiftHours(row: AttendanceRecord): string | null {
  if (!row.shift_start || !row.shift_end) return null;

  return `${displayPunchTime(row.shift_start)} - ${displayPunchTime(row.shift_end)}`;
}

// Three distinct outcomes, which the table used to collapse into one "-":
// overtime worked, a genuine zero against a real shift, and "cannot tell"
// because no shift was assigned.
function displayOvertime(row: AttendanceRecord): { text: string; computable: boolean } {
  if (!hasShift(row)) return { text: "No shift", computable: false };

  return {
    text: row.overtime_display ?? `${row.overtime_minutes ?? 0}m`,
    computable: true,
  };
}

function AdminAttendance() {
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  // The day comes from the header calendar, so every date-driven page in the
  // app is looking at the same one.
  const { date, isDefault: isGlobalDateDefault, resetDate: resetGlobalDate } =
    useGlobalDate();
  const [departmentId, setDepartmentId] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [status, setStatus] = useState("");
  const [shiftId, setShiftId] = useState("");
  const queryClient = useQueryClient();
  const { data: departmentsData } = useDepartments();
  const { data: shiftsData } = useShifts();
  const { data: optionsData } = useQuery({
    queryKey: queryKeys.admin.attendanceOptions(),
    queryFn: () => attendanceService.listOptions(),
    staleTime: 30 * 60 * 1000,
  });

  const departments = departmentsData ?? [];
  const shifts = shiftsData ?? [];
  const workLocations = optionsData?.work_locations ?? [];

  const [overtimeOnly, setOvertimeOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [showShiftManager, setShowShiftManager] = useState(false);
  const [detailRow, setDetailRow] = useState<AttendanceRecord | null>(null);
  const [markForm, setMarkForm] = useState({
    employee_id: "",
    date: date,
    status: "present" as AttendanceStatus,
    shift_id: "",
    in_time: "",
    out_time: "",
  });
  const [isMarkingAttendance, setIsMarkingAttendance] = useState(false);
  const [markError, setMarkError] = useState("");
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    async function loadAttendance() {
      setError("");
      const [attendanceResult, summaryResult] = await Promise.allSettled([
        attendanceService.list({
          date,
          department_id: departmentId || undefined,
          status: status || undefined,
          search: search || undefined,
          shift_id: shiftId || undefined,
          work_location: workLocation || undefined,
          overtime: overtimeOnly || undefined,
          page,
          limit,
        }),
        attendanceService.summary(date, departmentId || undefined),
      ]);

      if (!isCurrent) return;

      if (attendanceResult.status === "fulfilled") {
        const attendance = attendanceResult.value;
        if (Array.isArray(attendance.items)) {
          setRecords(attendance.items);
          setTotal(attendance.total ?? attendance.items.length);
        } else {
          setRecords([]);
          setError("Attendance API returned an invalid response.");
        }
      } else {
        const requestError = attendanceResult.reason;
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Failed to load attendance data.",
        );
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        setSummary(null);
      }

      setIsLoading(false);
    }

    loadAttendance();

    return () => {
      isCurrent = false;
    };
  }, [
    date,
    departmentId,
    limit,
    overtimeOnly,
    page,
    search,
    shiftId,
    status,
    workLocation,
    attendanceRefreshKey,
  ]);


  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  // Counts only the filters shown in the filter card. The separate search box
  // in the table toolbar is cleared by resetFilters but not counted here.
  const activeFilterCount =
    [departmentId, workLocation, shiftId, status].filter(Boolean).length +
    (overtimeOnly ? 1 : 0);

  const overtimeTotalMinutes = summary?.overtime_total_minutes ?? 0;
  const overtimeStaffCount = summary?.overtime_employee_count ?? 0;

  function resetFilters() {
    setPage(1);
    setDepartmentId("");
    setWorkLocation("");
    setStatus("");
    setShiftId("");
    setOvertimeOnly(false);
    setSearch("");
    setActiveTab(0);
  }

  async function handleMarkAttendance() {
    if (!markForm.employee_id) {
      setMarkError("Please select an employee");
      return;
    }
    if (!markForm.status) {
      setMarkError("Please select a status");
      return;
    }

    setIsMarkingAttendance(true);
    setMarkError("");

    try {
      await attendanceService.mark({
        employee_id: markForm.employee_id,
        date: markForm.date,
        status: markForm.status,
        // Empty means "use the employee's own assigned shift", which lets the
        // backend resolve the shift and derive overtime from it.
        shift_id: markForm.shift_id || null,
        in_time: markForm.in_time || undefined,
        out_time: markForm.out_time || undefined,
      });

      // Reload data
      setShowMarkModal(false);
      setMarkForm({
        employee_id: "",
        date: date,
        status: "present",
        shift_id: "",
        in_time: "",
        out_time: "",
      });

      // Refresh the attendance list
      const attendanceResult = await attendanceService.list({
        date,
        department_id: departmentId || undefined,
        status: status || undefined,
        search: search || undefined,
        shift_id: shiftId || undefined,
        work_location: workLocation || undefined,
        overtime: overtimeOnly || undefined,
        page,
        limit,
      });
      setRecords(attendanceResult.items);

      const summaryResult = await attendanceService.summary(
        date,
        departmentId || undefined,
      );
      setSummary(summaryResult);

      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.attendanceSummary(markForm.date),
      });
    } catch (err) {
      const errorMsg =
        err instanceof ApiError
          ? err.message
          : "Failed to mark attendance";
      setMarkError(errorMsg);
    } finally {
      setIsMarkingAttendance(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / limit));

  // 1 2 3 4 5 … 25 — first four, last, current window, gap marker for the rest.
  const pageNumbers = useMemo(() => {
    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, index) => index + 1);
    }

    const pages: (number | null)[] = [1, 2, 3, 4];

    if (page > 5) pages.push(page - 1, page);

    if (page < pageCount - 4) pages.push(pageCount - 3, pageCount - 2, pageCount - 1);

    pages.push(pageCount);

    return [...new Set(pages)].sort((a, b) => (a ?? 0) - (b ?? 0)).map((value, index, all) => {
      // null where a real page was skipped, so the ellipsis renders in between.
      const previous = all[index - 1];
      const hasGap = value !== null && previous !== null && value - previous > 1;

      return hasGap ? null : value;
    });
  }, [page, pageCount]);

  const sortedRecords = useMemo(() => {
    if (!sortKey) return records;

    const sorted = [...records].sort((a, b) => {
      const valueA = getSortValue(a, sortKey);
      const valueB = getSortValue(b, sortKey);

      if (valueA < valueB) return -1;
      if (valueA > valueB) return 1;
      return 0;
    });

    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [records, sortKey, sortDirection]);

  // Color map for sub percentages - using inline styles to ensure colors are applied
  const subColorStyles = {
    "Present Today": { color: "#059669" }, // emerald-600
    "Late Today": { color: "#f97316" }, // orange-500
    "On Leave": { color: "#9333ea" }, // purple-600
    "Absent Today": { color: "#e11d48" }, // rose-600
  };

  const summaryCards = [
    { label: "Total Employees", value: summary?.total_employees ?? "-", sub: summary ? "100%" : "-", subStyle: { color: "#2563eb" }, icon: Users, iconBg: "bg-blue-50", iconColor: "text-blue-600", card: "bg-blue-50/40 border-blue-200" },
    { label: "Present Today", value: summary?.present_count ?? "-", sub: summary ? `${summary.present_percentage}%` : "-", subStyle: subColorStyles["Present Today"], icon: UserCheck, iconBg: "bg-emerald-50", iconColor: "text-emerald-600", card: "bg-emerald-50/40 border-emerald-200" },
    { label: "Late Today", value: summary?.late_count ?? "-", sub: summary ? `${summary.late_percentage}%` : "-", subStyle: subColorStyles["Late Today"], icon: Clock, iconBg: "bg-orange-50", iconColor: "text-orange-500", card: "bg-orange-50/40 border-orange-200" },
    { label: "On Leave", value: summary?.on_leave_count ?? "-", sub: summary ? `${summary.on_leave_percentage}%` : "-", subStyle: subColorStyles["On Leave"], icon: CalendarDays, iconBg: "bg-purple-50", iconColor: "text-purple-600", card: "bg-purple-50/40 border-purple-200" },
    { label: "Absent Today", value: summary?.absent_count ?? "-", sub: summary ? `${summary.absent_percentage}%` : "-", subStyle: subColorStyles["Absent Today"], icon: UserX, iconBg: "bg-rose-50", iconColor: "text-rose-600", card: "bg-rose-50/40 border-rose-200" },
  ];

  const summaryTotals = summary
    ? [
        { label: "Present", value: summary.present_count, pct: `${summary.present_percentage}%`, color: "bg-emerald-500" },
        { label: "Late", value: summary.late_count, pct: `${summary.late_percentage}%`, color: "bg-orange-500" },
        { label: "Leave", value: summary.on_leave_count, pct: `${summary.on_leave_percentage}%`, color: "bg-purple-500" },
        { label: "Absent", value: summary.absent_count, pct: `${summary.absent_percentage}%`, color: "bg-rose-500" },
      ]
    : [];

  const formatStatus = (value: AttendanceStatus) =>
    value === "on_leave" ? "On Leave" : value === "missing_punch" ? "Missing Punch" : value.charAt(0).toUpperCase() + value.slice(1);

  const initials = (record: AttendanceRecord) =>
    `${record.employee.first_name[0] ?? ""}${record.employee.last_name[0] ?? ""}`;

  function exportAttendance() {
    const escapeCell = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rows = sortedRecords
      .map((row) => [
        `${row.employee.first_name} ${row.employee.last_name}`,
        row.employee.employee_code,
        row.employee.department_name ?? "-",
        displayShift(row),
        displayPunchTime(row.in_time ?? row.check_in),
        displayPunchTime(row.out_time ?? row.check_out),
        displayWorkingHours(row.working_hours ?? row.total_hours),
        displayOvertime(row).text,
        formatStatus(row.status),
      ])
      .map(
        (values) =>
          `<tr>${values
            .map((value) => `<td>${escapeCell(String(value))}</td>`)
            .join("")}</tr>`,
      )
      .join("");

    const workbook = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="UTF-8" /></head>
        <body><table>
          <tr><th>Employee</th><th>Employee ID</th><th>Department</th><th>Shift</th><th>In Time</th><th>Out Time</th><th>Working Hours</th><th>Overtime</th><th>Status</th></tr>
          ${rows}
        </table></body>
      </html>`;

    const blob = new Blob([workbook], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `attendance-${date}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 2xl:px-10">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl xl:text-4xl">Daily Attendance</h1>
          <p className="mt-1 text-gray-500">
            View and manage employees attendance for a selected date.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportAttendance}
            className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            onClick={() => setShowMarkModal(true)}
          >
            <UserPlus className="h-4 w-4" />
            Mark Attendance
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-5 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-5 xl:gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`min-h-[96px] rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md ${card.card}`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                  <Icon className={`h-6 w-6 ${card.iconColor}`} />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-gray-600">{card.label}</p>

                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900">{card.value}</span>
                    {card.sub && (
                      <span className="text-xs font-semibold" style={card.subStyle}>{card.sub}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-gray-900">Filters</p>

          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            aria-expanded={showFilters}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 lg:hidden"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showFilters ? "Hide" : "Show"}
            {activeFilterCount > 0 && ` (${activeFilterCount})`}
          </button>
        </div>

        <div className={`${showFilters ? "grid" : "hidden"} grid-cols-1 items-end gap-x-3 gap-y-4 sm:grid-cols-2 lg:grid lg:grid-cols-4 2xl:grid-cols-8`}>
        <div className="min-w-0">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            Date
          </label>
          {/* The header calendar owns this value, so the page shows it rather
              than offering a second control that could disagree with it. */}
          <div className="flex h-10 items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 text-sm font-medium text-gray-700">
            <CalendarDays className="h-4 w-4 text-gray-400" />
            <span className="truncate">{formatSelectedDate(date)}</span>
            {!isGlobalDateDefault && (
              <button
                type="button"
                onClick={resetGlobalDate}
                className="ml-auto shrink-0 text-xs font-semibold text-[#2563eb] hover:underline"
              >
                Today
              </button>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Department</label>
          <select
            value={departmentId}
            onChange={(event) => { setDepartmentId(event.target.value); setPage(1); }}
            className={filterControlClass}
          >
            <option value="">All Departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Location</label>
          <select
            value={workLocation}
            onChange={(event) => { setWorkLocation(event.target.value); setPage(1); }}
            className={filterControlClass}
          >
            <option value="">All Locations</option>
            {workLocations.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Shift</label>
          <select
            value={shiftId}
            onChange={(event) => { setShiftId(event.target.value); setPage(1); }}
            className={filterControlClass}
          >
            <option value="">All Shifts</option>
            {shifts.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.name}
                {shift.is_overnight ? " (ends next day)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Status</label>
          <select
            value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(1); setActiveTab(0); }}
            className={filterControlClass}
          >
            <option value="">All Status</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
            <option value="on_leave">On Leave</option>
          </select>
        </div>

        <div className="min-w-0">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Overtime</label>
          <select
            value={overtimeOnly ? "ot" : ""}
            onChange={(event) => { setOvertimeOnly(event.target.value === "ot"); setPage(1); setActiveTab(0); }}
            className={filterControlClass}
          >
            <option value="">All Records</option>
            <option value="ot">Overtime only</option>
          </select>
        </div>

        {/* Overtime total for the selected date - fills the row and answers
            "how much extra time" without opening a report. */}
        <div className="min-w-0">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">Overtime Today</label>
          <div
            title={`${overtimeTotalMinutes} minutes across ${overtimeStaffCount} employee(s)`}
            className={`flex h-10 w-full items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
              overtimeTotalMinutes > 0
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-gray-200 bg-gray-50 text-gray-400"
            }`}
          >
            <Timer className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {summary?.overtime_total_display ?? "0h"}
              <span className="font-normal opacity-80">
                {" · "}
                {overtimeStaffCount} staff
              </span>
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <p className="mb-1.5 block text-xs font-medium">
            {activeFilterCount > 0 ? (
              <span className="text-amber-600">{activeFilterCount} active</span>
            ) : (
              <span>&nbsp;</span>
            )}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            disabled={activeFilterCount === 0}
            className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border border-gray-200 bg-white px-5 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 xl:w-auto"
          >
            <RotateCcw className="h-4 w-4 shrink-0" />
            Clear filters
          </button>
        </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white px-3 py-2 shadow-sm [scrollbar-width:none]">
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            onClick={() => { setPage(1); setActiveTab(index); setStatus(tab.status ?? ""); }}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeTab === index
                ? "bg-[#2563eb] text-white"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            }`}
          >
            {tab.label} ({summary ? (tab.status === "present" ? summary.present_count : tab.status === "late" ? summary.late_count : tab.status === "on_leave" ? summary.on_leave_count : tab.status === "absent" ? summary.absent_count : tab.status === "missing_punch" ? summary.missing_punch_count : summary.total_employees) : "-"})
          </button>
        ))}
      </div>

      {/* Keep the full-width attendance table together; analytics follow it in
          a responsive row instead of leaving a long empty column beside it. */}
      <div className="flex min-w-0 flex-col gap-5">
        {/* Table */}
        <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Search by name, employee ID..."
                className="w-72 rounded-full border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-[#2563eb] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              Show
              <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }} className="rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-700 focus:outline-none">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              entries
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-bold uppercase tracking-wide text-gray-600">
                  <th className="w-8 pb-3">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </th>
                  {columns.map((column) => {
                    const isActive = sortKey === column.key;
                    return (
                      <th key={column.key} className="pb-3 font-bold">
                        <button
                          type="button"
                          onClick={() => handleSort(column.key)}
                          className={`inline-flex items-center gap-1 font-bold uppercase tracking-wide transition ${
                            isActive ? "text-[#2563eb]" : "text-gray-600 hover:text-[#2563eb]"
                          }`}
                          aria-label={`Sort by ${column.label}`}
                        >
                          {column.label}
                          <span className="inline-flex flex-col leading-[7px]">
                            <ArrowUp
                              className={`h-2.5 w-2.5 ${
                                isActive && sortDirection === "asc" ? "text-[#2563eb]" : "text-gray-300"
                              }`}
                            />
                            <ArrowDown
                              className={`h-2.5 w-2.5 ${
                                isActive && sortDirection === "desc" ? "text-[#2563eb]" : "text-gray-300"
                              }`}
                            />
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableRowSkeleton rows={6} columns={10} />
                ) : error ? (
                  <tr><td colSpan={10} className="py-10 text-center text-rose-600">{error}</td></tr>
                ) : sortedRecords.length === 0 ? (
                  <tr><td colSpan={10} className="py-10 text-center text-gray-500">No attendance records found.</td></tr>
                ) : sortedRecords.map((row) => (
                  <tr key={row.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-4">
                      <input type="checkbox" className="rounded border-gray-300" />
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
                        >
                          {initials(row)}
                        </div>
                        <span className="font-semibold text-gray-900">{row.employee.first_name} {row.employee.last_name}</span>
                      </div>
                    </td>
                    <td className="py-4 text-gray-600">{row.employee.employee_code}</td>
                    <td className="py-4 text-gray-600">{row.employee.department_name ?? "-"}</td>
                    <td className="py-4">
                      <div className="text-gray-700">{displayShift(row)}</div>

                      {displayShiftHours(row) && (
                        <div className="mt-0.5 text-[11px] text-gray-400">
                          {displayShiftHours(row)}
                        </div>
                      )}

                      {row.is_overnight && (
                        <div className="mt-0.5 text-[11px] text-violet-600">
                          Ends next day
                        </div>
                      )}

                      {!hasShift(row) && (
                        <div className="mt-0.5 text-[11px] text-gray-400">
                          No shift length
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-gray-600">{displayPunchTime(row.in_time ?? row.check_in)}</td>
                    <td className="py-4 text-gray-600">{displayPunchTime(row.out_time ?? row.check_out)}</td>
                    <td className="py-4 text-gray-600">{displayWorkingHours(row.working_hours ?? row.total_hours)}</td>
                    <td className="py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusStyles[row.status]}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDot[row.status]}`} />
                        {formatStatus(row.status)}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          View
                        </button>

                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          aria-label={`More actions for ${row.employee.first_name} ${row.employee.last_name}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Card list below md. A 8-column table is unusable at 375px and
              horizontal scroll hides half the row behind the viewport edge. */}
          <div className="mt-4 space-y-3 md:hidden">
            {isLoading ? (
              <CardSkeleton count={3} lines={2} className="space-y-3" />
            ) : error ? (
              <p className="py-6 text-center text-sm text-rose-600">{error}</p>
            ) : sortedRecords.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">No attendance records found.</p>
            ) : (
              sortedRecords.map((row) => (
                <div key={row.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                      {initials(row)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {row.employee.first_name} {row.employee.last_name}
                      </p>

                      <p className="truncate text-xs text-gray-500">
                        {row.employee.employee_code} · {row.employee.department_name ?? "-"}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusStyles[row.status]}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot[row.status]}`} />
                      {formatStatus(row.status)}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-50 pt-3 text-xs">
                    <div>
                      <dt className="text-gray-400">Shift</dt>
                      <dd className="font-medium text-gray-700">{displayShift(row)}</dd>
                    </div>

                    <div>
                      <dt className="text-gray-400">In</dt>
                      <dd className="font-medium text-gray-700">{displayPunchTime(row.in_time ?? row.check_in)}</dd>
                    </div>

                    <div>
                      <dt className="text-gray-400">Out</dt>
                      <dd className="font-medium text-gray-700">{displayPunchTime(row.out_time ?? row.check_out)}</dd>
                    </div>

                    <div>
                      <dt className="text-gray-400">Worked</dt>
                      <dd className="font-medium text-gray-700">{displayWorkingHours(row.working_hours ?? row.total_hours)}</dd>
                    </div>

                    <div className="col-span-2">
                      <dt className="text-gray-400">Overtime</dt>
                      <dd className="font-medium text-gray-700">{displayOvertime(row).text}</dd>
                    </div>
                  </dl>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
            <span>
              Showing {total ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, total)} of {total} entries
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((current) => current - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition hover:bg-gray-50 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {pageNumbers.map((entry, index) =>
                entry === null ? (
                  <span key={`gap-${index}`} className="px-1 text-gray-400">…</span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setPage(entry)}
                    aria-current={entry === page ? "page" : undefined}
                    className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition ${
                      entry === page
                        ? "bg-[#2563eb] text-white"
                        : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {entry}
                  </button>
                ),
              )}

              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => current + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition hover:bg-gray-50 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="order-first grid min-w-0 auto-rows-fr grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Attendance Summary */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-bold text-gray-900">Attendance Summary</h3>

            <div className="flex justify-center">
              <AttendanceDonut summary={summary} />
            </div>

            <div className="mt-5 flex flex-col gap-2.5">
              {summaryTotals.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-gray-600">
                    <span className={`h-2 w-2 rounded-full ${item.color}`} />
                    {item.label}
                  </span>

                  <span className="font-medium text-gray-700">
                    {item.value} ({item.pct})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Department Wise Present % */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-bold text-gray-900">Department Wise Present %</h3>

            <div className="flex flex-col gap-4">
              {(summary?.department_presence ?? []).map((dept) => (
                <div key={dept.department_id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-gray-600">{dept.department_name}</span>
                    <span className="font-semibold text-gray-900">{dept.present_percentage}%</span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-[#2563eb]"
                      style={{ width: `${dept.present_percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-bold text-gray-900">Quick Actions</h3>

            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => {
                      if (action.label === "Mark Attendance") setShowMarkModal(true);
                      if (action.label === "Process Regularization")
                        document.getElementById("regularization-requests")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      if (action.label === "Generate Report") exportAttendance();
                      if (action.label === "Manage Shifts") setShowShiftManager(true);
                    }}
                    className="flex min-w-0 flex-col items-start gap-2 rounded-xl border border-gray-100 p-3 text-left transition hover:border-gray-200 hover:bg-gray-50"
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${action.iconBg}`}>
                      <Icon className={`h-4 w-4 ${action.iconColor}`} />
                    </span>

                    <span className="w-full break-words text-xs font-medium leading-tight text-gray-700">
                      {action.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div id="regularization-requests" className="scroll-mt-6">
            <RegularizationRequestsCard
              onReviewed={() => setAttendanceRefreshKey((current) => current + 1)}
            />
          </div>
        </div>
      </div>

      {/* Row detail. The Action column's View button and kebab both land here. */}
      {detailRow && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setDetailRow(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-lg sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                  {initials(detailRow)}
                </span>

                <div>
                  <h2 className="font-bold text-gray-900">
                    {detailRow.employee.first_name} {detailRow.employee.last_name}
                  </h2>

                  <p className="text-sm text-gray-500">
                    {detailRow.employee.employee_code} · {detailRow.employee.department_name ?? "-"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailRow(null)}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                ["Date", detailRow.date],
                ["Status", formatStatus(detailRow.status)],
                ["Shift", displayShift(detailRow)],
                ["Shift hours", displayShiftHours(detailRow) ?? "--"],
                ["In time", displayPunchTime(detailRow.in_time ?? detailRow.check_in)],
                ["Out time", displayPunchTime(detailRow.out_time ?? detailRow.check_out)],
                ["Working hours", displayWorkingHours(detailRow.working_hours ?? detailRow.total_hours)],
                ["Overtime", displayOvertime(detailRow).text],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-gray-400">{label}</dt>
                  <dd className="font-medium text-gray-700">{value}</dd>
                </div>
              ))}
            </dl>

            {detailRow.notes && (
              <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                {detailRow.notes}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Mark Attendance Modal */}
      {showMarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Mark Attendance</h2>

            {markError && (
              <div className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-600">
                {markError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Employee
                </label>
                <select
                  value={markForm.employee_id}
                  onChange={(e) =>
                    setMarkForm((prev) => ({
                      ...prev,
                      employee_id: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                >
                  <option value="">Select an employee</option>
                  {records.map((record) => (
                    <option key={record.id} value={record.employee.id}>
                      {record.employee.first_name} {record.employee.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Date
                  </label>
                  <input
                    type="date"
                    value={markForm.date}
                    onChange={(e) =>
                      setMarkForm((prev) => ({
                        ...prev,
                        date: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    value={markForm.status}
                    onChange={(e) =>
                      setMarkForm((prev) => ({
                        ...prev,
                        status: e.target.value as AttendanceStatus,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                  >
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                    <option value="on_leave">On Leave</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Shift
                </label>
                <select
                  value={markForm.shift_id}
                  onChange={(e) =>
                    setMarkForm((prev) => ({
                      ...prev,
                      shift_id: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                >
                  <option value="">Employee's assigned shift</option>
                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} ({formatShiftTime(shift.start_time)} -{" "}
                      {formatShiftTime(shift.end_time)})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Overtime is worked time beyond this shift's length.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    In Time
                  </label>
                  <input
                    type="time"
                    value={markForm.in_time}
                    onChange={(e) =>
                      setMarkForm((prev) => ({
                        ...prev,
                        in_time: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Out Time
                  </label>
                  <input
                    type="time"
                    value={markForm.out_time}
                    onChange={(e) =>
                      setMarkForm((prev) => ({
                        ...prev,
                        out_time: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowMarkModal(false);
                    setMarkError("");
                  }}
                  disabled={isMarkingAttendance}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMarkAttendance}
                  disabled={isMarkingAttendance}
                  className="flex-1 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50"
                >
                  {isMarkingAttendance ? "Saving..." : "Mark Attendance"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Shifts Modal */}
      {showShiftManager && (
        <ShiftManagerModal
          onClose={() => setShowShiftManager(false)}
          onChanged={() => setAttendanceRefreshKey((current) => current + 1)}
        />
      )}
    </div>
  );
}

export default AdminAttendance;

