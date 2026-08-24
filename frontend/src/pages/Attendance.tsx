import { useEffect, useState } from "react";
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
import { ApiError } from "../services/api";
import { attendanceService } from "../services/attendanceService";
import { departmentService } from "../services/departmentService";
import type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummary,
} from "../types/attendance";
import type { Department } from "../types/department";

// TODO: replace with real services/attendanceService.ts + types/attendance.ts
// once the backend Attendance API is available (see EMP001-style pattern
// used in employeeService).

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

function Attendance() {
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("2026-08-21");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError("");

    Promise.all([
      attendanceService.list({
        date,
        department_id: departmentId || undefined,
        status: status || undefined,
        search: search || undefined,
        page: 1,
        limit: 10,
      }),
      attendanceService.summary(date, departmentId || undefined),
      departmentService.list(),
    ])
      .then(([attendance, attendanceSummary, departmentList]) => {
        if (!isCurrent) return;
        setRecords(attendance.items);
        setSummary(attendanceSummary);
        setDepartments(departmentList);
      })
      .catch((requestError: unknown) => {
        if (!isCurrent) return;
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Failed to load attendance data.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [date, departmentId, search, status]);

  const summaryCards = [
    { label: "Total Employees", value: summary?.total_employees ?? "-", sub: null, subColor: "", icon: Users, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
    { label: "Present Today", value: summary?.present_count ?? "-", sub: summary ? `${summary.present_percentage}%` : "-", subColor: "text-emerald-600", icon: UserCheck, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
    { label: "Late Today", value: summary?.late_count ?? "-", sub: summary ? `${summary.late_percentage}%` : "-", subColor: "text-orange-500", icon: Clock, iconBg: "bg-orange-50", iconColor: "text-orange-500" },
    { label: "On Leave", value: summary?.on_leave_count ?? "-", sub: summary ? `${summary.on_leave_percentage}%` : "-", subColor: "text-purple-600", icon: CalendarDays, iconBg: "bg-purple-50", iconColor: "text-purple-600" },
    { label: "Absent Today", value: summary?.absent_count ?? "-", sub: summary ? `${summary.absent_percentage}%` : "-", subColor: "text-rose-600", icon: UserX, iconBg: "bg-rose-50", iconColor: "text-rose-600" },
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
            className="flex items-center gap-2 rounded-full bg-[#456b54] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#385b46]"
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
                  <span className={`text-sm font-semibold ${card.subColor}`}>{card.sub}</span>
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
            className="w-full rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-[#456b54] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Department</label>
          <select
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            className="w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 focus:border-[#456b54] focus:outline-none"
          >
            <option value="">All Departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Location</label>
          <select className="w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 focus:border-[#456b54] focus:outline-none">
            <option>All Locations</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Shift</label>
          <select className="w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 focus:border-[#456b54] focus:outline-none">
            <option>All Shifts</option>
            <option>General</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
          <select
            value={status}
            onChange={(event) => { setStatus(event.target.value); setActiveTab(0); }}
            className="w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 focus:border-[#456b54] focus:outline-none"
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
            onClick={() => { setDepartmentId(""); setStatus(""); setSearch(""); setActiveTab(0); }}
            className="flex-1 rounded-full bg-[#456b54] px-4 py-2 text-sm font-semibold text-white hover:bg-[#385b46]"
          >
            Apply Filter
          </button>
          <button
            type="button"
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
            onClick={() => { setActiveTab(index); setStatus(tab.status ?? ""); }}
            className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition ${
              activeTab === index
                ? "border-[#456b54] text-[#456b54]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label} ({summary ? (tab.status === "present" ? summary.present_count : tab.status === "late" ? summary.late_count : tab.status === "on_leave" ? summary.on_leave_count : tab.status === "absent" ? summary.absent_count : tab.status === "missing_punch" ? summary.missing_punch_count : summary.total_employees) : "-"})
          </button>
        ))}
      </div>

      {/* Content: table + sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Table */}
        <div className="self-start rounded-3xl bg-white p-6 shadow-sm lg:col-span-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, employee ID..."
                className="w-72 rounded-full border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-[#456b54] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              Show
              <select className="rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-700 focus:outline-none">
                <option>10</option>
                <option>25</option>
                <option>50</option>
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
                  {[
                    "Employee",
                    "Employee ID",
                    "Department",
                    "Shift",
                    "In Time",
                    "Out Time",
                    "Working Hours",
                    "Status",
                  ].map((heading) => (
                    <th key={heading} className="pb-3 font-bold">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-bold uppercase tracking-wide text-gray-600 hover:text-[#456b54]"
                        aria-label={`Sort by ${heading}`}
                      >
                        {heading}
                        <span className="inline-flex flex-col leading-[7px]">
                          <ArrowUp className="h-2.5 w-2.5" />
                          <ArrowDown className="h-2.5 w-2.5" />
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={9} className="py-10 text-center text-gray-500">Loading attendance...</td></tr>
                ) : error ? (
                  <tr><td colSpan={9} className="py-10 text-center text-rose-600">{error}</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={9} className="py-10 text-center text-gray-500">No attendance records found.</td></tr>
                ) : records.map((row) => (
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
                      <div className="text-xs text-gray-400">{row.shift_start} - {row.shift_end}</div>
                    </td>
                    <td className="py-4 text-gray-600">{row.in_time ?? "--"}</td>
                    <td className="py-4 text-gray-600">{row.out_time ?? "--"}</td>
                    <td className="py-4 text-gray-600">{row.working_hours ?? "--"}</td>
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
            <span>Showing 1 to {records.length} of {summary?.total_employees ?? 0} entries</span>
            <div className="flex items-center gap-1.5">
              <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#456b54] font-semibold text-white">
                1
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                2
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                3
              </button>
              <span className="px-1 text-gray-400">...</span>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                25
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
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
                      className="h-full rounded-full bg-[#456b54]"
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
      </div>
    </div>
  );
}

export default Attendance;