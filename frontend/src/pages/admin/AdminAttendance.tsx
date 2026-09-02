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
  CalendarPlus,
  Settings,
  Users2,
} from "lucide-react";
import { ApiError } from "../../services/api";
import { attendanceService } from "../../services/attendanceService";
import { departmentService } from "../../services/departmentService";
import type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummary,
} from "../../types/attendance";
import type { Department } from "../../types/department";
import RegularizationRequestsCard from "../../components/admin/RegularizationRequestsCard";

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

const quickActions = [
  { label: "Mark Attendance", icon: UserPlus, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
  { label: "Process Regularization", icon: ClipboardEdit, iconBg: "bg-orange-50", iconColor: "text-orange-500" },
  { label: "Generate Report", icon: FileText, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  { label: "Manage Shifts", icon: Users2, iconBg: "bg-violet-50", iconColor: "text-violet-600" },
  { label: "Add Holiday", icon: CalendarPlus, iconBg: "bg-rose-50", iconColor: "text-rose-600" },
  { label: "Attendance Settings", icon: Settings, iconBg: "bg-gray-100", iconColor: "text-gray-600" },
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

/** "9h 14m" / "9h" / numeric hours -> total minutes, for numeric ordering. */
function workingHoursToMinutes(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return Number.NEGATIVE_INFINITY;
  }
  if (typeof value === "number") return value * 60;

  const match = value.match(/(\d+)h(?:\s*(\d+)m)?/);
  if (!match) return Number.NEGATIVE_INFINITY;

  const hours = parseInt(match[1], 10);
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

function getToday(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function displayPunchTime(value: string | null | undefined): string {
  if (!value) return "--";

  if (value.includes("T")) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  return value;
}

function displayWorkingHours(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "--";
  return typeof value === "number" ? `${value}h` : value;
}

function AdminAttendance() {
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(getToday);
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [markForm, setMarkForm] = useState({
    employee_id: "",
    date: getToday(),
    status: "present" as AttendanceStatus,
    shift: "General",
    in_time: "",
    out_time: "",
  });
  const [isMarkingAttendance, setIsMarkingAttendance] = useState(false);
  const [markError, setMarkError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadAttendance() {
      setError("");
      const [attendanceResult, summaryResult, departmentsResult] =
        await Promise.allSettled([
          attendanceService.list({
            date,
            department_id: departmentId || undefined,
            status: status || undefined,
            search: search || undefined,
            page,
            limit,
          }),
          attendanceService.summary(date, departmentId || undefined),
          departmentService.list(),
        ]);

      if (!isCurrent) return;

      if (attendanceResult.status === "fulfilled") {
        const attendance = attendanceResult.value;
        if (Array.isArray(attendance.items)) {
          setRecords(attendance.items);
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

      if (departmentsResult.status === "fulfilled") {
        setDepartments(departmentsResult.value);
      }

      setIsLoading(false);
    }

    loadAttendance();

    return () => {
      isCurrent = false;
    };
  }, [date, departmentId, limit, page, search, status]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
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
        shift: markForm.shift,
        in_time: markForm.in_time || undefined,
        out_time: markForm.out_time || undefined,
      });

      // Reload data
      setShowMarkModal(false);
      setMarkForm({
        employee_id: "",
        date: getToday(),
        status: "present",
        shift: "General",
        in_time: "",
        out_time: "",
      });

      // Refresh the attendance list
      const attendanceResult = await attendanceService.list({
        date,
        department_id: departmentId || undefined,
        status: status || undefined,
        search: search || undefined,
        page,
        limit,
      });
      setRecords(attendanceResult.items);

      const summaryResult = await attendanceService.summary(
        date,
        departmentId || undefined,
      );
      setSummary(summaryResult);
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
    { label: "Total Employees", value: summary?.total_employees ?? "-", sub: null, subStyle: {}, icon: Users, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
    { label: "Present Today", value: summary?.present_count ?? "-", sub: summary ? `${summary.present_percentage}%` : "-", subStyle: subColorStyles["Present Today"], icon: UserCheck, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
    { label: "Late Today", value: summary?.late_count ?? "-", sub: summary ? `${summary.late_percentage}%` : "-", subStyle: subColorStyles["Late Today"], icon: Clock, iconBg: "bg-orange-50", iconColor: "text-orange-500" },
    { label: "On Leave", value: summary?.on_leave_count ?? "-", sub: summary ? `${summary.on_leave_percentage}%` : "-", subStyle: subColorStyles["On Leave"], icon: CalendarDays, iconBg: "bg-purple-50", iconColor: "text-purple-600" },
    { label: "Absent Today", value: summary?.absent_count ?? "-", sub: summary ? `${summary.absent_percentage}%` : "-", subStyle: subColorStyles["Absent Today"], icon: UserX, iconBg: "bg-rose-50", iconColor: "text-rose-600" },
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

  return (
    <div className="px-10 pb-10 pt-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Daily Attendance</h1>
          <p className="mt-1 text-gray-500">
            View and manage employees attendance for a selected date.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
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
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-3xl bg-white p-5 shadow-sm">
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}>
                <Icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{card.value}</span>
                {card.sub && (
                  <span className="text-sm font-semibold" style={card.subStyle}>{card.sub}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 gap-3 rounded-3xl bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Date</label>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-full rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Department</label>
          <select
            value={departmentId}
            onChange={(event) => { setDepartmentId(event.target.value); setPage(1); }}
            className="w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 focus:border-[#2563eb] focus:outline-none"
          >
            <option value="">All Departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Location</label>
          <select className="w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 focus:border-[#2563eb] focus:outline-none">
            <option>All Locations</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Shift</label>
          <select className="w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 focus:border-[#2563eb] focus:outline-none">
            <option>All Shifts</option>
            <option>General</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
          <select
            value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(1); setActiveTab(0); }}
            className="w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 focus:border-[#2563eb] focus:outline-none"
          >
            <option value="">All Status</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
            <option value="on_leave">On Leave</option>
            <option value="missing_punch">Missing Punch</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setPage(1)}
            className="flex-1 rounded-full bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
          >
            Apply Filter
          </button>
          <button
            type="button"
            onClick={() => { setPage(1); setDepartmentId(""); setStatus(""); setSearch(""); setActiveTab(0); }}
            className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-6 border-b border-gray-200 px-1">
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            onClick={() => { setPage(1); setActiveTab(index); setStatus(tab.status ?? ""); }}
            className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition ${
              activeTab === index
                ? "border-[#2563eb] text-[#2563eb]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label} ({summary ? (tab.status === "present" ? summary.present_count : tab.status === "late" ? summary.late_count : tab.status === "on_leave" ? summary.on_leave_count : tab.status === "absent" ? summary.absent_count : tab.status === "missing_punch" ? summary.missing_punch_count : summary.total_employees) : "-"})
          </button>
        ))}
      </div>

      {/* Row 1: Summary cards side by side */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Attendance Summary */}
        <div className="rounded-3xl bg-white p-6 shadow-sm">
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
        <div className="rounded-3xl bg-white p-6 shadow-sm">
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
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-bold text-gray-900">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  className="flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-gray-100 p-3 text-left hover:bg-gray-50"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${action.iconBg}`}
                  >
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
      </div>

      {/* Row 2: Table + Regularization side by side */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Table */}
        <div className="min-w-0 flex-1 self-start rounded-3xl bg-white p-6 shadow-sm">
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

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
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
                  <tr><td colSpan={9} className="py-10 text-center text-gray-500">Loading attendance...</td></tr>
                ) : error ? (
                  <tr><td colSpan={9} className="py-10 text-center text-rose-600">{error}</td></tr>
                ) : sortedRecords.length === 0 ? (
                  <tr><td colSpan={9} className="py-10 text-center text-gray-500">No attendance records found.</td></tr>
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
                      <div className="text-gray-700">{row.shift}</div>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
            <span>Showing {records.length ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, records.length + (page - 1) * limit)} entries</span>
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-semibold text-gray-700">{page}</span>
              <button type="button" disabled={records.length < limit} onClick={() => setPage((current) => current + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Regularization Requests */}
        <div className="flex w-full flex-col gap-6 lg:w-80">
          <RegularizationRequestsCard />
        </div>
      </div>

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
                    <option value="missing_punch">Missing Punch</option>
                  </select>
                </div>
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
    </div>
  );
}

export default AdminAttendance;