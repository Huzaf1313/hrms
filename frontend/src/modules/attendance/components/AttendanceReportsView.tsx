import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Download, Search, Users, CheckCircle2, Clock, AlertTriangle, Timer } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { StatusPill } from "../../../components/ui/Badge";
import { Avatar } from "../../../components/ui/Avatar";
import { StatCard } from "../../../components/ui/StatCard";
import { TableSkeleton } from "../../../components/ui/Skeleton";
import { EmptyState } from "../../../components/ui/EmptyState";
import {
  attendanceReportsService,
  type AttendanceReportResult,
  type ReportType,
} from "../../../services/mock/attendanceReportsMockService";

interface AttendanceReportsViewProps {
  className?: string;
}

export const AttendanceReportsView: React.FC<AttendanceReportsViewProps> = ({ className = "" }) => {
  const [reportType, setReportType] = useState<ReportType>("monthly_summary");
  const [month, setMonth] = useState("2026-11");
  const [department, setDepartment] = useState("all");
  const [search, setSearch] = useState("");
  const [reportData, setReportData] = useState<AttendanceReportResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReport = useCallback(() => {
    setIsLoading(true);
    attendanceReportsService
      .getReport({
        type: reportType,
        month,
        departmentId: department === "all" ? undefined : department,
        search: search || undefined,
      })
      .then((data) => {
        setReportData(data);
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

  const reportTabs: { id: ReportType; label: string }[] = useMemo(
    () => [
      { id: "monthly_summary", label: "Monthly Summary" },
      { id: "late_arrivals", label: "Late Arrivals" },
      { id: "absenteeism", label: "Absenteeism" },
      { id: "working_hours", label: "Working Hours" },
    ],
    [],
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Controls & Toolbar in a single row */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        {/* Left: Report Type Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md">
          {reportTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportType(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                reportType === tab.id
                  ? "bg-white text-blue-600 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Filters & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sample data badge */}
          {reportData?.isMock && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Sample data
            </span>
          )}

          {/* Month selector */}
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-8 px-2.5 text-xs rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-600"
          />

          {/* Department filter */}
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="h-8 px-2.5 text-xs rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-600"
          >
            <option value="all">All Departments</option>
            <option value="Engineering">Engineering</option>
            <option value="Product & Design">Product & Design</option>
            <option value="Human Resources">Human Resources</option>
            <option value="Sales & Marketing">Sales & Marketing</option>
            <option value="Finance & Operations">Finance & Operations</option>
          </select>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee..."
              className="h-8 pl-8 pr-2.5 text-xs rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-600 w-36 sm:w-44"
            />
          </div>

          {/* Export CSV button */}
          <Button
            variant="outline"
            size="xs"
            onClick={handleExportCsv}
            leftIcon={<Download className="w-3.5 h-3.5" />}
            className="h-8 text-xs font-medium"
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {reportData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            label="Total Employees"
            value={reportData.totals.total_employees}
            subtext="Tracked in period"
            icon={<Users className="w-4 h-4 text-slate-500" />}
          />
          <StatCard
            label="Avg Attendance"
            value={`${reportData.totals.avg_attendance_rate}%`}
            subtext="Organization rate"
            dotColor="bg-emerald-500"
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          />
          <StatCard
            label="Late Arrivals"
            value={reportData.totals.total_late_instances}
            subtext="Total instances"
            dotColor="bg-amber-500"
            icon={<Clock className="w-4 h-4 text-amber-600" />}
          />
          <StatCard
            label="Unplanned Absent"
            value={reportData.totals.total_absent_days}
            subtext="Days missed"
            dotColor="bg-rose-500"
            icon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
          />
          <StatCard
            label="Avg Daily Hours"
            value={`${reportData.totals.avg_hours}h`}
            subtext="Standard 8.0h"
            icon={<Timer className="w-4 h-4 text-slate-500" />}
          />
        </div>
      )}

      {/* Main Report Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={8} columns={6} />
          </div>
        ) : !reportData ? (
          <div className="py-12">
            <EmptyState title="No report data" description="Unable to load report data." />
          </div>
        ) : reportType === "monthly_summary" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3 text-right">Scheduled</th>
                  <th className="py-2.5 px-3 text-right">Present</th>
                  <th className="py-2.5 px-3 text-right">Late</th>
                  <th className="py-2.5 px-3 text-right">Absent</th>
                  <th className="py-2.5 px-3 text-right">Half Day</th>
                  <th className="py-2.5 px-3 text-right">Leave</th>
                  <th className="py-2.5 px-3 text-right">Total Hours</th>
                  <th className="py-2.5 px-3 text-right">Avg Hrs/Day</th>
                  <th className="py-2.5 px-3 text-right">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.monthlySummary.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      No records match the current filters.
                    </td>
                  </tr>
                ) : (
                  reportData.monthlySummary.map((row) => (
                    <tr key={row.employee_code} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <Avatar name={row.name} size="xs" />
                          <div>
                            <span className="block font-medium">{row.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{row.employee_code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div>
                          <span>{row.department}</span>
                          <span className="text-[10px] text-slate-400 block">{row.designation}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">{row.scheduled_days}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-semibold">{row.present_days}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-600 font-medium">{row.late_days}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-600 font-medium">{row.absent_days}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">{row.half_days}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-blue-600">{row.leave_days}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">{row.total_hours.toFixed(1)}h</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-800">{row.avg_hours_per_day.toFixed(1)}h</td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span
                          className={`font-semibold ${
                            row.attendance_percentage >= 95
                              ? "text-emerald-700"
                              : row.attendance_percentage >= 85
                              ? "text-amber-700"
                              : "text-rose-700"
                          }`}
                        >
                          {row.attendance_percentage.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : reportType === "late_arrivals" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Shift Timing</th>
                  <th className="py-2.5 px-3">Scheduled In</th>
                  <th className="py-2.5 px-3">Actual In</th>
                  <th className="py-2.5 px-3 text-right">Delay (Mins)</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.lateArrivals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No late arrivals recorded.
                    </td>
                  </tr>
                ) : (
                  reportData.lateArrivals.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <Avatar name={row.name} size="xs" />
                          <div>
                            <span className="block font-medium">{row.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{row.employee_code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{row.department}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-mono">{row.date}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono">{row.shift_timing}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono">{row.scheduled_in}</td>
                      <td className="py-2.5 px-3 font-mono font-medium text-amber-700">{row.actual_in}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-600">
                        +{row.delay_minutes} min
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusPill
                          variant={row.status === "Regularized" ? "success" : row.status === "Grace Availed" ? "warning" : "danger"}
                        >
                          {row.status}
                        </StatusPill>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : reportType === "absenteeism" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Absence Classification</th>
                  <th className="py-2.5 px-3">Reporting Manager</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.absenteeism.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No absenteeism incidents recorded.
                    </td>
                  </tr>
                ) : (
                  reportData.absenteeism.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <Avatar name={row.name} size="xs" />
                          <div>
                            <span className="block font-medium">{row.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{row.employee_code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{row.department}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-mono">{row.date}</td>
                      <td className="py-2.5 px-3">
                        <StatusPill variant="danger">{row.type}</StatusPill>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{row.reporting_manager}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3 text-right">Target Expected Hours</th>
                  <th className="py-2.5 px-3 text-right">Logged Work Hours</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.workingHours.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  reportData.workingHours.map((row) => (
                    <tr key={row.employee_code} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <Avatar name={row.name} size="xs" />
                          <div>
                            <span className="block font-medium">{row.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{row.employee_code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{row.department}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">{row.expected_hours.toFixed(1)}h</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">{row.logged_hours.toFixed(1)}h</td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span
                          className={`font-semibold ${
                            row.difference_hours >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {row.difference_hours >= 0 ? `+${row.difference_hours.toFixed(1)}h` : `${row.difference_hours.toFixed(1)}h`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusPill
                          variant={row.status === "Target Met" ? "success" : row.status === "Overtime" ? "info" : "warning"}
                        >
                          {row.status}
                        </StatusPill>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
