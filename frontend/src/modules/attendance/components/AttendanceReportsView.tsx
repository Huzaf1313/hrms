import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Download,
  Search,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { Avatar } from "../../../components/ui/Avatar";
import { TableSkeleton } from "../../../components/ui/Skeleton";
import {
  attendanceReportsService,
  type AttendanceReportResult,
  type ReportType,
  type MonthlySummaryRow,
  type LateArrivalRow,
  type AbsenteeismRow,
  type WorkingHoursRow,
} from "../../../services/mock/attendanceReportsMockService";

interface AttendanceReportsViewProps {
  className?: string;
}

type SortDirection = "asc" | "desc";

function formatMonthLabel(monthStr: string): string {
  if (!monthStr) return "November 2026";
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export const AttendanceReportsView: React.FC<AttendanceReportsViewProps> = ({ className = "" }) => {
  const [reportType, setReportType] = useState<ReportType>("monthly_summary");
  const [month, setMonth] = useState("2026-11");
  const [department, setDepartment] = useState("all");
  const [search, setSearch] = useState("");
  const [reportData, setReportData] = useState<AttendanceReportResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Sorting state - null by default to preserve original order from data source
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null);

  const fetchReport = useCallback(() => {
    setIsLoading(true);
    setFetchError(null);
    attendanceReportsService
      .getReport({
        type: reportType,
        month,
        departmentId: department === "all" ? undefined : department,
        search: search.trim() || undefined,
      })
      .then((data) => {
        setReportData(data);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load report data.";
        setFetchError(msg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [reportType, month, department, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchReport();
  }, [fetchReport]);

  const handleExportCsv = () => {
    if (!reportData) return;
    const filename = `attendance_${reportType}_${month}.csv`;
    attendanceReportsService.exportCsv(reportData, filename);
  };

  // 3-way sort cycle: ascending -> descending -> original order (null)
  const handleSort = (field: string) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection("asc");
    } else if (sortDirection === "asc") {
      setSortDirection("desc");
    } else {
      setSortField(null);
      setSortDirection(null);
    }
  };

  const reportTabs: { id: ReportType; label: string }[] = useMemo(
    () => [
      { id: "monthly_summary", label: "Monthly Summary" },
      { id: "late_arrivals", label: "Late Arrivals" },
      { id: "absenteeism", label: "Absent" },
      { id: "working_hours", label: "Working Hours" },
    ],
    [],
  );

  // Sorted data for Monthly Summary - preserves default data order when sortField is null
  const sortedMonthlySummary = useMemo(() => {
    if (!reportData?.monthlySummary) return [];
    if (!sortField || !sortDirection) return reportData.monthlySummary;
    const list = [...reportData.monthlySummary];
    list.sort((a, b) => {
      let aVal: string | number = a[sortField as keyof MonthlySummaryRow] ?? "";
      let bVal: string | number = b[sortField as keyof MonthlySummaryRow] ?? "";

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [reportData, sortField, sortDirection]);

  // Sorted data for Late Arrivals - preserves default data order when sortField is null
  const sortedLateArrivals = useMemo(() => {
    if (!reportData?.lateArrivals) return [];
    if (!sortField || !sortDirection) return reportData.lateArrivals;
    const list = [...reportData.lateArrivals];
    list.sort((a, b) => {
      let aVal: string | number = a[sortField as keyof LateArrivalRow] ?? "";
      let bVal: string | number = b[sortField as keyof LateArrivalRow] ?? "";

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [reportData, sortField, sortDirection]);

  // Sorted data for Absenteeism - preserves default data order when sortField is null
  const sortedAbsenteeism = useMemo(() => {
    if (!reportData?.absenteeism) return [];
    if (!sortField || !sortDirection) return reportData.absenteeism;
    const list = [...reportData.absenteeism];
    list.sort((a, b) => {
      let aVal: string | number = a[sortField as keyof AbsenteeismRow] ?? "";
      let bVal: string | number = b[sortField as keyof AbsenteeismRow] ?? "";

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [reportData, sortField, sortDirection]);

  // Sorted data for Working Hours - preserves default data order when sortField is null
  const sortedWorkingHours = useMemo(() => {
    if (!reportData?.workingHours) return [];
    if (!sortField || !sortDirection) return reportData.workingHours;
    const list = [...reportData.workingHours];
    list.sort((a, b) => {
      let aVal: string | number = a[sortField as keyof WorkingHoursRow] ?? "";
      let bVal: string | number = b[sortField as keyof WorkingHoursRow] ?? "";

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [reportData, sortField, sortDirection]);

  // Client-side Monthly Summary Totals & Averages for Footer Row
  const monthlySummaryFooter = useMemo(() => {
    const rows = sortedMonthlySummary;
    const count = rows.length;
    if (count === 0) return null;

    const totalScheduled = rows.reduce((acc, r) => acc + r.scheduled_days, 0);
    const totalPresent = rows.reduce((acc, r) => acc + r.present_days, 0);
    const totalLate = rows.reduce((acc, r) => acc + r.late_days, 0);
    const totalAbsent = rows.reduce((acc, r) => acc + r.absent_days, 0);
    const totalHalfDay = rows.reduce((acc, r) => acc + r.half_days, 0);
    const totalLeave = rows.reduce((acc, r) => acc + r.leave_days, 0);
    const totalHours = rows.reduce((acc, r) => acc + r.total_hours, 0);
    const avgHrsPerDay = rows.reduce((acc, r) => acc + r.avg_hours_per_day, 0) / count;
    const avgAttendance = rows.reduce((acc, r) => acc + r.attendance_percentage, 0) / count;

    return {
      totalScheduled,
      totalPresent,
      totalLate,
      totalAbsent,
      totalHalfDay,
      totalLeave,
      totalHours,
      avgHrsPerDay,
      avgAttendance,
    };
  }, [sortedMonthlySummary]);

  // 5 KPI strip items
  const kpiItems = useMemo(() => {
    if (!reportData) return [];
    return [
      {
        label: "Total Employees",
        value: reportData.totals.total_employees,
        helper: "Tracked in period",
        dotColor: "bg-[#6B7280]",
      },
      {
        label: "Avg Attendance",
        value: `${reportData.totals.avg_attendance_rate}%`,
        helper: "Organization presence",
        dotColor: "bg-[#10B981]",
      },
      {
        label: "Late Arrivals",
        value: reportData.totals.total_late_instances,
        helper: "Grace period exceeded",
        dotColor: "bg-[#F59E0B]",
      },
      {
        label: "Unplanned Absent",
        value: reportData.totals.total_absent_days,
        helper: "Days unexcused",
        dotColor: "bg-[#EF4444]",
      },
      {
        label: "Avg Daily Hours",
        value: `${reportData.totals.avg_hours}h`,
        helper: "Standard 8.0h shift",
        dotColor: "bg-[#6B7280]",
      },
    ];
  }, [reportData]);

  // Helper for rendering sort indicator (no icon active by default; faint icon only on hover)
  const renderSortHeader = (field: string, label: string, alignRight = false) => {
    const isActive = sortField === field && sortDirection !== null;
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
        className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-[11px] whitespace-nowrap text-[#6B7280] hover:text-[#111827] transition-colors cursor-pointer group focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2F5FD0] rounded px-1 -mx-1 ${
          alignRight ? "ml-auto" : ""
        }`}
      >
        <span className="whitespace-nowrap">{label}</span>
        {isActive ? (
          sortDirection === "asc" ? (
            <ArrowUp className="w-3.5 h-3.5 text-[#2F5FD0] shrink-0" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-[#2F5FD0] shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 text-[#9CA3AF] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </button>
    );
  };

  // Card table title wording: "Late Arrival Records" specifically for late_arrivals tab
  const tableTitle = useMemo(() => {
    if (reportType === "late_arrivals") return "Late Arrival Records";
    const tab = reportTabs.find((t) => t.id === reportType);
    return `${tab?.label ?? "Report"} Records`;
  }, [reportType, reportTabs]);

  return (
    <div className={`flex flex-col gap-5 w-full ${className}`}>
      {/* Filter Bar (One Row at >= 1100px; 32px / h-8 Controls; Compact py-2 Padding) */}
      <div className="flex flex-col min-[1100px]:flex-row min-[1100px]:items-center justify-between gap-3 bg-white px-3.5 py-2 rounded-lg border border-[#E5E7EB] shadow-none">
        {/* Left: Sub-Tab Pills */}
        <div className="flex items-center gap-1 bg-[#F3F4F6] p-0.5 rounded-lg border border-[#E5E7EB] overflow-x-auto shrink-0">
          {reportTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setReportType(tab.id);
                setSortField(null);
                setSortDirection(null);
              }}
              className={`h-7 px-3 text-[12px] font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2F5FD0] ${
                reportType === tab.id
                  ? "bg-white text-[#2F5FD0] font-semibold shadow-xs border border-[#E5E7EB]"
                  : "text-[#4B5563] hover:text-[#111827]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Controls in Exact Order: [Sample data], Month, Department, Search, Export CSV */}
        <div className="flex flex-wrap min-[1100px]:flex-nowrap items-center gap-2 w-full min-[1100px]:w-auto justify-start min-[1100px]:justify-end">
          {/* 1. Sample data badge (32px / h-8) */}
          {reportData?.isMock && (
            <span className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[11px] font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] shrink-0">
              Sample data
            </span>
          )}

          {/* 2. Month input (~150px, 32px / h-8) */}
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Select report month"
            className="h-8 w-[150px] shrink-0 px-2.5 text-[13px] rounded-md border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] cursor-pointer"
          />

          {/* 3. Department filter (~170px, 32px / h-8, custom dropdown chevron) */}
          <div className="relative w-[170px] shrink-0">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              aria-label="Filter by department"
              className="appearance-none h-8 w-full pl-3 pr-8 text-[13px] rounded-md border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] cursor-pointer truncate"
            >
              <option value="all">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Product & Design">Product & Design</option>
              <option value="Human Resources">Human Resources</option>
              <option value="Sales & Marketing">Sales & Marketing</option>
              <option value="Finance & Operations">Finance & Operations</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#6B7280] pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>

          {/* 4. Search input (min-width 200px, flexible, 32px / h-8) */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-[#6B7280] pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee..."
              aria-label="Search employee"
              className="h-8 w-full pl-8 pr-3 text-[13px] rounded-md border border-[#E5E7EB] bg-white text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#2F5FD0]"
            />
          </div>

          {/* 5. Export CSV button (32px / h-8, auto width, shrink-0) */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!reportData || isLoading}
            className="h-8 w-auto shrink-0 px-3 text-[12px] font-medium inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB] hover:text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] cursor-pointer transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Section with Section Header */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              MONTHLY OVERVIEW
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#4B5563] font-medium border border-[#E5E7EB]">
              {formatMonthLabel(month)}
            </span>
          </div>
        </div>

        {/* 5 Equal-Height KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpiItems.map((item, idx) => (
            <div
              key={idx}
              className="h-[100px] p-4 rounded-lg border border-[#E5E7EB] bg-white shadow-kpi flex flex-col justify-between min-w-0"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${item.dotColor}`} />
                <span className="text-[12px] font-medium text-[#4B5563] truncate">
                  {item.label}
                </span>
              </div>
              <div>
                <span className="text-[24px] font-semibold text-[#111827] tracking-tight leading-none block">
                  {item.value}
                </span>
              </div>
              <span className="text-[11px] text-[#6B7280] truncate block">
                {item.helper}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Report Table Container */}
      <div className="rounded-lg border border-[#E5E7EB] bg-white overflow-hidden shadow-none">
        {/* Table Toolbar: Title & Result Count */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E5E7EB] bg-white">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-[#111827]">
              {tableTitle}
            </h3>
            {reportType === "working_hours" && (
              <span
                className="inline-flex items-center gap-1 text-[11px] text-[#6B7280] cursor-help"
                title="Target Met: Logged hours within ±5.0h tolerance of Target. Hours Deficit: >5.0h deficit. Overtime: >5.0h surplus."
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span className="hidden sm:inline">Tolerance: ±5h</span>
              </span>
            )}
          </div>
          <span className="text-[12px] font-medium text-[#6B7280] tabular-nums whitespace-nowrap">
            {reportType === "monthly_summary" && `${sortedMonthlySummary.length} employees`}
            {reportType === "late_arrivals" && `${sortedLateArrivals.length} records`}
            {reportType === "absenteeism" && `${sortedAbsenteeism.length} records`}
            {reportType === "working_hours" && `${sortedWorkingHours.length} employees`}
          </span>
        </div>

        {/* Table Content States */}
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={8} columns={7} />
          </div>
        ) : fetchError ? (
          <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-8 h-8 text-[#DC2626] mb-2" />
            <p className="text-sm font-semibold text-[#111827]">{fetchError}</p>
            <p className="text-xs text-[#6B7280] mt-1 mb-4">Please try refreshing the report data.</p>
            <button
              type="button"
              onClick={fetchReport}
              className="h-8 px-3.5 rounded-md bg-[#2F5FD0] text-xs font-semibold text-white hover:bg-[#254BB5] transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : reportType === "monthly_summary" ? (
          /* TAB 1: MONTHLY SUMMARY */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] border-collapse min-w-[1060px]">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] sticky top-0 z-10">
                <tr className="h-10">
                  <th className="py-0 px-4 bg-[#F9FAFB] w-56 min-w-[200px] whitespace-nowrap">
                    {renderSortHeader("name", "Employee")}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] w-44 min-w-[170px] whitespace-nowrap">
                    {renderSortHeader("department", "Department")}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] text-right w-24 min-w-[85px] whitespace-nowrap">
                    {renderSortHeader("scheduled_days", "Scheduled", true)}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] text-right w-24 min-w-[85px] whitespace-nowrap">
                    {renderSortHeader("present_days", "Present", true)}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] text-right w-20 min-w-[70px] whitespace-nowrap">
                    {renderSortHeader("late_days", "Late", true)}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] text-right w-20 min-w-[70px] whitespace-nowrap">
                    {renderSortHeader("absent_days", "Absent", true)}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] text-right w-24 min-w-[85px] whitespace-nowrap">
                    {renderSortHeader("half_days", "Half Day", true)}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] text-right w-20 min-w-[70px] whitespace-nowrap">
                    {renderSortHeader("leave_days", "Leave", true)}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] text-right w-28 min-w-[105px] whitespace-nowrap">
                    {renderSortHeader("total_hours", "Total Hours", true)}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] text-right w-32 min-w-[120px] whitespace-nowrap">
                    {renderSortHeader("avg_hours_per_day", "Avg Hrs/Day", true)}
                  </th>
                  <th
                    className="py-0 px-4 bg-[#F9FAFB] text-right w-36 min-w-[135px] whitespace-nowrap"
                    title="Attendance Rate: ≥95% (High/Green), 85–94.9% (Moderate/Amber), <85% (Low/Red)"
                  >
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      {renderSortHeader("attendance_percentage", "Attendance %", true)}
                      <HelpCircle className="w-3 h-3 text-[#9CA3AF] shrink-0" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
                {sortedMonthlySummary.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-[#6B7280]">
                      <FileSpreadsheet className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" />
                      <p className="text-[13px] font-medium text-[#111827]">No records for this month and filters</p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">Try selecting a different department or clearing the search query.</p>
                    </td>
                  </tr>
                ) : (
                  sortedMonthlySummary.map((row) => (
                    <tr key={row.employee_code} className="h-12 hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-0 px-4 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.name} size="xs" />
                          <div className="min-w-0">
                            <span className="block font-medium text-[13px] text-[#111827] truncate leading-tight">
                              {row.name}
                            </span>
                            <span className="text-[11px] text-[#6B7280] block mt-0.5 leading-tight tabular-nums">
                              {row.employee_code}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-0 px-4 align-middle whitespace-nowrap">
                        <div className="min-w-0">
                          <span className="block text-[13px] text-[#4B5563] truncate leading-tight">
                            {row.department}
                          </span>
                          <span className="text-[11px] text-[#6B7280] block mt-0.5 leading-tight truncate">
                            {row.designation}
                          </span>
                        </div>
                      </td>
                      <td className="py-0 px-4 align-middle text-right tabular-nums text-[#4B5563] whitespace-nowrap">
                        {row.scheduled_days}
                      </td>
                      <td className="py-0 px-4 align-middle text-right tabular-nums font-medium text-[#111827] whitespace-nowrap">
                        {row.present_days}
                      </td>
                      {/* Late: muted grey for 0, amber for >0 */}
                      <td className={`py-0 px-4 align-middle text-right tabular-nums whitespace-nowrap ${row.late_days === 0 ? "text-[#9CA3AF]" : "text-[#B45309] font-medium"}`}>
                        {row.late_days}
                      </td>
                      {/* Absent: muted grey for 0, red for >0 */}
                      <td className={`py-0 px-4 align-middle text-right tabular-nums whitespace-nowrap ${row.absent_days === 0 ? "text-[#9CA3AF]" : "text-[#B91C1C] font-semibold"}`}>
                        {row.absent_days}
                      </td>
                      {/* Half Day: muted grey for 0, normal for >0 */}
                      <td className={`py-0 px-4 align-middle text-right tabular-nums whitespace-nowrap ${row.half_days === 0 ? "text-[#9CA3AF]" : "text-[#111827]"}`}>
                        {row.half_days}
                      </td>
                      {/* Leave: muted grey for 0, normal for >0 */}
                      <td className={`py-0 px-4 align-middle text-right tabular-nums whitespace-nowrap ${row.leave_days === 0 ? "text-[#9CA3AF]" : "text-[#111827]"}`}>
                        {row.leave_days}
                      </td>
                      <td className="py-0 px-4 align-middle text-right tabular-nums text-[#111827] whitespace-nowrap">
                        {row.total_hours.toFixed(1)}h
                      </td>
                      <td className="py-0 px-4 align-middle text-right tabular-nums text-[#111827] whitespace-nowrap">
                        {row.avg_hours_per_day.toFixed(1)}h
                      </td>
                      <td className="py-0 px-4 align-middle text-right tabular-nums whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-semibold text-[13px] leading-tight ${
                              row.attendance_percentage >= 95
                                ? "text-[#03543F]"
                                : row.attendance_percentage >= 85
                                ? "text-[#92400E]"
                                : "text-[#9B1C1C]"
                            }`}
                          >
                            {row.attendance_percentage.toFixed(1)}%
                          </span>
                          {/* Thin 3px progress bar */}
                          <div className="w-16 h-[3px] bg-[#E5E7EB] rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full ${
                                row.attendance_percentage >= 95
                                  ? "bg-[#10B981]"
                                  : row.attendance_percentage >= 85
                                  ? "bg-[#F59E0B]"
                                  : "bg-[#EF4444]"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, row.attendance_percentage))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Summary Footer Row */}
              {monthlySummaryFooter && (
                <tfoot className="border-t-2 border-[#E5E7EB] bg-[#F9FAFB] font-semibold text-[13px] text-[#111827]">
                  <tr className="h-12">
                    <td className="py-0 px-4 align-middle whitespace-nowrap">
                      <span>Total / Average</span>
                    </td>
                    <td className="py-0 px-4 align-middle text-[11px] text-[#6B7280] whitespace-nowrap">
                      {sortedMonthlySummary.length} employees
                    </td>
                    <td className="py-0 px-4 align-middle text-right tabular-nums whitespace-nowrap">
                      {monthlySummaryFooter.totalScheduled}
                    </td>
                    <td className="py-0 px-4 align-middle text-right tabular-nums whitespace-nowrap">
                      {monthlySummaryFooter.totalPresent}
                    </td>
                    <td className="py-0 px-4 align-middle text-right tabular-nums text-[#B45309] whitespace-nowrap">
                      {monthlySummaryFooter.totalLate}
                    </td>
                    <td className="py-0 px-4 align-middle text-right tabular-nums text-[#B91C1C] whitespace-nowrap">
                      {monthlySummaryFooter.totalAbsent}
                    </td>
                    <td className="py-0 px-4 align-middle text-right tabular-nums whitespace-nowrap">
                      {monthlySummaryFooter.totalHalfDay}
                    </td>
                    <td className="py-0 px-4 align-middle text-right tabular-nums whitespace-nowrap">
                      {monthlySummaryFooter.totalLeave}
                    </td>
                    <td className="py-0 px-4 align-middle text-right tabular-nums whitespace-nowrap">
                      {monthlySummaryFooter.totalHours.toFixed(1)}h
                    </td>
                    <td className="py-0 px-4 align-middle text-right tabular-nums whitespace-nowrap">
                      {monthlySummaryFooter.avgHrsPerDay.toFixed(1)}h
                    </td>
                    <td className="py-0 px-4 align-middle text-right tabular-nums whitespace-nowrap">
                      <span
                        className={`${
                          monthlySummaryFooter.avgAttendance >= 95
                            ? "text-[#03543F]"
                            : monthlySummaryFooter.avgAttendance >= 85
                            ? "text-[#92400E]"
                            : "text-[#9B1C1C]"
                        }`}
                      >
                        {monthlySummaryFooter.avgAttendance.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : reportType === "late_arrivals" ? (
          /* TAB 2: LATE ARRIVALS */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] border-collapse min-w-[1040px]">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] sticky top-0 z-10">
                <tr className="h-10">
                  <th className="py-0 px-4 bg-[#F9FAFB] w-56 min-w-[200px] whitespace-nowrap">
                    {renderSortHeader("name", "Employee")}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] w-44 min-w-[160px] whitespace-nowrap">
                    {renderSortHeader("department", "Department")}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] w-32 min-w-[110px] whitespace-nowrap">
                    {renderSortHeader("date", "Date")}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] w-48 min-w-[180px] whitespace-nowrap">
                    {renderSortHeader("shift_timing", "Shift Timing")}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] w-36 min-w-[130px] whitespace-nowrap">
                    {renderSortHeader("scheduled_in", "Scheduled In")}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] w-32 min-w-[110px] whitespace-nowrap">
                    {renderSortHeader("actual_in", "Actual In")}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] text-right w-36 min-w-[130px] whitespace-nowrap">
                    {renderSortHeader("delay_minutes", "Delay (Mins)", true)}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] w-36 min-w-[120px] whitespace-nowrap">
                    {renderSortHeader("status", "Status")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
                {sortedLateArrivals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#6B7280]">
                      <FileSpreadsheet className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" />
                      <p className="text-[13px] font-medium text-[#111827]">No records for this month and filters</p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">No late arrival incidents recorded under current filters.</p>
                    </td>
                  </tr>
                ) : (
                  sortedLateArrivals.map((row) => {
                    const isGrace = row.status === "Grace Availed";

                    return (
                      <tr key={row.id} className="h-12 hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-0 px-4 align-middle whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={row.name} size="xs" />
                            <div className="min-w-0">
                              <span className="block font-medium text-[13px] text-[#111827] truncate leading-tight">
                                {row.name}
                              </span>
                              <span className="text-[11px] text-[#6B7280] block mt-0.5 leading-tight tabular-nums">
                                {row.employee_code}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-0 px-4 align-middle text-[#4B5563] whitespace-nowrap">{row.department}</td>
                        <td className="py-0 px-4 align-middle text-[#111827] tabular-nums whitespace-nowrap">{row.date}</td>
                        <td className="py-0 px-4 align-middle text-[#6B7280] tabular-nums whitespace-nowrap">{row.shift_timing}</td>
                        <td className="py-0 px-4 align-middle text-[#6B7280] tabular-nums whitespace-nowrap">{row.scheduled_in}</td>
                        <td className="py-0 px-4 align-middle text-[#111827] font-medium tabular-nums whitespace-nowrap">{row.actual_in}</td>
                        {/* Delay: red only for Late Mark / Regularized; amber for Grace Availed */}
                        <td
                          className={`py-0 px-4 align-middle text-right tabular-nums whitespace-nowrap ${
                            isGrace ? "text-[#92400E] font-medium" : "text-[#9B1C1C] font-semibold"
                          }`}
                        >
                          +{row.delay_minutes} min
                        </td>
                        <td className="py-0 px-4 align-middle whitespace-nowrap">
                          {row.status === "Late Mark" ? (
                            <span className="inline-flex items-center gap-1.5 h-5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FDF2F2] text-[#9B1C1C] border border-[#F8B4B4]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                              Late Mark
                            </span>
                          ) : row.status === "Grace Availed" ? (
                            <span className="inline-flex items-center gap-1.5 h-5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                              Grace Availed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 h-5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                              Regularized
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : reportType === "absenteeism" ? (
          /* TAB 3: ABSENTEEISM */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] border-collapse min-w-[870px]">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] sticky top-0 z-10">
                <tr className="h-10">
                  <th className="py-0 px-4 bg-[#F9FAFB] w-56 min-w-[200px] whitespace-nowrap">
                    {renderSortHeader("name", "Employee")}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] w-44 min-w-[160px] whitespace-nowrap">
                    {renderSortHeader("department", "Department")}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] w-36 min-w-[120px] whitespace-nowrap">
                    {renderSortHeader("date", "Date")}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] w-64 min-w-[220px] whitespace-nowrap">
                    {renderSortHeader("type", "Absence Classification")}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] min-w-[180px] whitespace-nowrap">
                    {renderSortHeader("reporting_manager", "Reporting Manager")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
                {sortedAbsenteeism.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#6B7280]">
                      <FileSpreadsheet className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" />
                      <p className="text-[13px] font-medium text-[#111827]">No records for this month and filters</p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">No absent records under current filters.</p>
                    </td>
                  </tr>
                ) : (
                  sortedAbsenteeism.map((row) => (
                    <tr key={row.id} className="h-12 hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-0 px-4 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={row.name} size="xs" />
                          <div className="min-w-0">
                            <span className="block font-medium text-[13px] text-[#111827] truncate leading-tight">
                              {row.name}
                            </span>
                            <span className="text-[11px] text-[#6B7280] block mt-0.5 leading-tight tabular-nums">
                              {row.employee_code}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-0 px-4 align-middle text-[#4B5563] whitespace-nowrap">{row.department}</td>
                      <td className="py-0 px-4 align-middle text-[#111827] tabular-nums whitespace-nowrap">{row.date}</td>
                      <td className="py-0 px-4 align-middle whitespace-nowrap">
                        {row.type === "Unapproved Leave" ? (
                          <span className="inline-flex items-center gap-1.5 h-5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                            {row.type}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 h-5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FDF2F2] text-[#9B1C1C] border border-[#F8B4B4]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                            {row.type}
                          </span>
                        )}
                      </td>
                      <td className="py-0 px-4 align-middle text-[13px] text-[#4B5563] whitespace-nowrap">{row.reporting_manager}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* TAB 4: WORKING HOURS */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] border-collapse min-w-[965px]">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#6B7280] sticky top-0 z-10">
                <tr className="h-10">
                  <th className="py-0 px-4 bg-[#F9FAFB] w-56 min-w-[200px] whitespace-nowrap">
                    {renderSortHeader("name", "Employee")}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] w-44 min-w-[160px] whitespace-nowrap">
                    {renderSortHeader("department", "Department")}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] text-right w-56 min-w-[200px] whitespace-nowrap">
                    {renderSortHeader("expected_hours", "Target Expected Hours", true)}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] text-right w-52 min-w-[185px] whitespace-nowrap">
                    {renderSortHeader("logged_hours", "Logged Work Hours", true)}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] text-right w-32 min-w-[110px] whitespace-nowrap">
                    {renderSortHeader("difference_hours", "Variance", true)}
                  </th>
                  <th className="py-0 px-4 bg-[#F9FAFB] w-36 min-w-[120px] whitespace-nowrap">
                    {renderSortHeader("status", "Status")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
                {sortedWorkingHours.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#6B7280]">
                      <FileSpreadsheet className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" />
                      <p className="text-[13px] font-medium text-[#111827]">No records for this month and filters</p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5">No working hours data found under current filters.</p>
                    </td>
                  </tr>
                ) : (
                  sortedWorkingHours.map((row) => {
                    const percentOfTarget = Math.min(100, Math.round((row.logged_hours / row.expected_hours) * 100));

                    return (
                      <tr key={row.employee_code} className="h-12 hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-0 px-4 align-middle whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={row.name} size="xs" />
                            <div className="min-w-0">
                              <span className="block font-medium text-[13px] text-[#111827] truncate leading-tight">
                                {row.name}
                              </span>
                              <span className="text-[11px] text-[#6B7280] block mt-0.5 leading-tight tabular-nums">
                                {row.employee_code}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-0 px-4 align-middle text-[#4B5563] whitespace-nowrap">{row.department}</td>
                        <td className="py-0 px-4 align-middle text-right tabular-nums text-[#4B5563] whitespace-nowrap">
                          {row.expected_hours.toFixed(1)}h
                        </td>
                        <td className="py-0 px-4 align-middle text-right tabular-nums whitespace-nowrap">
                          <div className="flex flex-col items-end">
                            <span className="font-medium text-[13px] text-[#111827] leading-tight">
                              {row.logged_hours.toFixed(1)}h
                            </span>
                            {/* Thin progress bar showing logged vs target */}
                            <div className="w-20 h-[3px] bg-[#E5E7EB] rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full ${
                                  row.status === "Target Met"
                                    ? "bg-[#10B981]"
                                    : row.status === "Overtime"
                                    ? "bg-[#2F5FD0]"
                                    : "bg-[#F59E0B]"
                                }`}
                                style={{ width: `${percentOfTarget}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        {/* Variance: neutral grey for within-tolerance, green for positive overtime, red for negative deficit */}
                        <td className="py-0 px-4 align-middle text-right tabular-nums whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              row.status === "Target Met"
                                ? "text-[#6B7280]"
                                : row.status === "Overtime"
                                ? "text-[#03543F]"
                                : "text-[#9B1C1C]"
                            }`}
                          >
                            {row.difference_hours > 0
                              ? `+${row.difference_hours.toFixed(1)}h`
                              : `${row.difference_hours.toFixed(1)}h`}
                          </span>
                        </td>
                        <td className="py-0 px-4 align-middle whitespace-nowrap">
                          {row.status === "Target Met" ? (
                            <span className="inline-flex items-center gap-1.5 h-5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                              Target Met
                            </span>
                          ) : row.status === "Overtime" ? (
                            <span className="inline-flex items-center gap-1.5 h-5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#E8EEFB] text-[#2F5FD0] border border-[#BFDBFE]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2F5FD0]" />
                              Overtime
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 h-5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                              Hours Deficit
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceReportsView;
