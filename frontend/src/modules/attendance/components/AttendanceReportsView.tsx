import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { StatusPill } from "../../../components/ui/Badge";
import { Avatar } from "../../../components/ui/Avatar";
import { StatStrip, type StatItem } from "../../../components/ui/StatStrip";
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

  const kpiItems: StatItem[] = useMemo(() => {
    if (!reportData) return [];
    return [
      {
        label: "Total Employees",
        value: reportData.totals.total_employees,
        helper: "Tracked in period",
        dotColor: "bg-[#5F6B76]",
      },
      {
        label: "Avg Attendance",
        value: `${reportData.totals.avg_attendance_rate}%`,
        helper: "Organization presence",
        dotColor: "bg-[#1E6B45]",
      },
      {
        label: "Late Arrivals",
        value: reportData.totals.total_late_instances,
        helper: "Grace period exceeded",
        dotColor: "bg-[#8A5A00]",
      },
      {
        label: "Unplanned Absent",
        value: reportData.totals.total_absent_days,
        helper: "Days unexcused",
        dotColor: "bg-[#A12D22]",
      },
      {
        label: "Avg Daily Hours",
        value: `${reportData.totals.avg_hours}h`,
        helper: "Standard 8.0h shift",
        dotColor: "bg-[#5F6B76]",
      },
    ];
  }, [reportData]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Controls & Toolbar in a single row */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-[8px] border border-[#E4E6E1] shadow-none">
        {/* Left: Report Type Tabs */}
        <div className="flex items-center gap-1 bg-[#F0F1EE] p-0.5 rounded-[6px]">
          {reportTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportType(tab.id)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-[5px] transition-colors ${
                reportType === tab.id
                  ? "bg-white text-[#2F5FD0] border border-[#E4E6E1] font-semibold"
                  : "text-[#52606D] hover:text-[#1F2933]"
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
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#FBF0D9] text-[#8A5A00]">
              Sample data
            </span>
          )}

          {/* Month selector */}
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-[34px] px-2.5 text-sm rounded-[6px] border border-[#E4E6E1] bg-white text-[#1F2933] focus:outline-none focus:border-[#2F5FD0]"
          />

          {/* Department filter */}
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="h-[34px] px-2.5 text-sm rounded-[6px] border border-[#E4E6E1] bg-white text-[#1F2933] focus:outline-none focus:border-[#2F5FD0]"
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
            <Search className="w-4 h-4 shrink-0 text-[#7B8794] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee..."
              className="h-[34px] pl-8 pr-2.5 text-sm rounded-[6px] border border-[#E4E6E1] bg-white text-[#1F2933] focus:outline-none focus:border-[#2F5FD0] w-36 sm:w-44"
            />
          </div>

          {/* Export CSV button */}
          <Button
            variant="outline"
            size="xs"
            onClick={handleExportCsv}
            leftIcon={<Download className="w-4 h-4 shrink-0" />}
            className="h-[34px] text-sm font-medium"
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards via StatStrip */}
      {reportData && <StatStrip items={kpiItems} />}

      {/* Main Report Table */}
      <div className="rounded-[8px] border border-[#E4E6E1] bg-white overflow-hidden shadow-none">
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
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-[#F6F7F5] border-b border-[#E4E6E1] text-[#7B8794] font-semibold text-[12px] normal-case tracking-normal h-[40px] sticky top-0">
                <tr className="h-[40px]">
                  <th className="py-0 px-4 bg-[#F6F7F5]">Employee</th>
                  <th className="py-0 px-4 bg-[#F6F7F5]">Department</th>
                  <th className="py-0 px-4 bg-[#F6F7F5] text-right">Scheduled</th>
                  <th className="py-0 px-4 bg-[#F6F7F5] text-right">Present</th>
                  <th className="py-0 px-4 bg-[#F6F7F5] text-right">Late</th>
                  <th className="py-0 px-4 bg-[#F6F7F5] text-right">Absent</th>
                  <th className="py-0 px-4 bg-[#F6F7F5] text-right">Half Day</th>
                  <th className="py-0 px-4 bg-[#F6F7F5] text-right">Leave</th>
                  <th className="py-0 px-4 bg-[#F6F7F5] text-right">Total Hours</th>
                  <th className="py-0 px-4 bg-[#F6F7F5] text-right">Avg Hrs/Day</th>
                  <th className="py-0 px-4 bg-[#F6F7F5] text-right">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E6E1] bg-white text-[#1F2933]">
                {reportData.monthlySummary.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-[#7B8794]">
                      No records match the current filters.
                    </td>
                  </tr>
                ) : (
                  reportData.monthlySummary.map((row) => (
                    <tr key={row.employee_code} className="h-[48px] hover:bg-[#FAFAF8] transition-colors">
                      <td className="py-0 px-4 align-middle font-medium text-[#1F2933]">
                        <div className="flex items-center gap-2">
                          <Avatar name={row.name} size="xs" />
                          <div>
                            <span className="block font-medium">{row.name}</span>
                            <span className="text-xs text-[#7B8794] font-mono">{row.employee_code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-0 px-4 align-middle text-[#52606D]">
                        <div>
                          <span>{row.department}</span>
                          <span className="text-xs text-[#7B8794] block">{row.designation}</span>
                        </div>
                      </td>
                      <td className="py-0 px-4 align-middle text-right font-mono text-[#52606D]">{row.scheduled_days}</td>
                      <td className="py-0 px-4 align-middle text-right font-mono text-[#1E6B45] font-semibold">{row.present_days}</td>
                      <td className="py-0 px-4 align-middle text-right font-mono text-[#8A5A00] font-medium">{row.late_days}</td>
                      <td className="py-0 px-4 align-middle text-right font-mono text-[#A12D22] font-medium">{row.absent_days}</td>
                      <td className="py-0 px-4 align-middle text-right font-mono text-[#52606D]">{row.half_days}</td>
                      <td className="py-0 px-4 align-middle text-right font-mono text-[#274C9E]">{row.leave_days}</td>
                      <td className="py-0 px-4 align-middle text-right font-mono text-[#1F2933]">{row.total_hours.toFixed(1)}h</td>
                      <td className="py-0 px-4 align-middle text-right font-mono text-[#1F2933]">{row.avg_hours_per_day.toFixed(1)}h</td>
                      <td className="py-0 px-4 align-middle text-right font-mono">
                        <span
                          className={`font-semibold ${
                            row.attendance_percentage >= 95
                              ? "text-[#1E6B45]"
                              : row.attendance_percentage >= 85
                              ? "text-[#8A5A00]"
                              : "text-[#A12D22]"
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
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-[#F6F7F5] border-b border-[#E4E6E1] text-[#7B8794] font-semibold text-[12px] normal-case tracking-normal h-[40px] sticky top-0">
                <tr className="h-[40px]">
                  <th className="py-0 px-4 bg-[#F6F7F5]">Employee</th>
                  <th className="py-0 px-4 bg-[#F6F7F5]">Department</th>
                  <th className="py-0 px-4 bg-[#F6F7F5]">Date</th>
                  <th className="py-0 px-4 bg-[#F6F7F5]">Shift Timing</th>
                  <th className="py-0 px-4 bg-[#F6F7F5]">Scheduled In</th>
                  <th className="py-0 px-4 bg-[#F6F7F5]">Actual In</th>
                  <th className="py-0 px-4 bg-[#F6F7F5] text-right">Delay (Mins)</th>
                  <th className="py-0 px-4 bg-[#F6F7F5]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E6E1] bg-white text-[#1F2933]">
                {reportData.lateArrivals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#7B8794]">
                      No late arrivals recorded.
                    </td>
                  </tr>
                ) : (
                  reportData.lateArrivals.map((row) => (
                    <tr key={row.id} className="h-[48px] hover:bg-[#FAFAF8] transition-colors">
                      <td className="py-0 px-4 align-middle font-medium text-[#1F2933]">
                        <div className="flex items-center gap-2">
                          <Avatar name={row.name} size="xs" />
                          <div>
                            <span className="block font-medium">{row.name}</span>
                            <span className="text-xs text-[#7B8794] font-mono">{row.employee_code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-0 px-4 align-middle text-[#52606D]">{row.department}</td>
                      <td className="py-0 px-4 align-middle text-[#1F2933] font-mono">{row.date}</td>
                      <td className="py-0 px-4 align-middle text-[#7B8794] font-mono">{row.shift_timing}</td>
                      <td className="py-0 px-4 align-middle text-[#7B8794] font-mono">{row.scheduled_in}</td>
                      <td className="py-0 px-4 align-middle font-mono font-medium text-[#8A5A00]">{row.actual_in}</td>
                      <td className="py-0 px-4 align-middle text-right font-mono font-semibold text-[#A12D22]">
                        +{row.delay_minutes} min
                      </td>
                      <td className="py-0 px-4 align-middle">
                        <StatusPill
                          variant={row.status === "Regularized" ? "ok" : row.status === "Grace Availed" ? "warn" : "bad"}
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
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-[#F6F7F5] border-b border-[#E4E6E1] text-[#7B8794] font-semibold text-[12px] normal-case tracking-normal h-[40px] sticky top-0">
                <tr className="h-[40px]">
                  <th className="py-0 px-4 bg-[#F6F7F5]">Employee</th>
                  <th className="py-0 px-4 bg-[#F6F7F5]">Department</th>
                  <th className="py-0 px-4 bg-[#F6F7F5]">Date</th>
                  <th className="py-0 px-4 bg-[#F6F7F5]">Absence Classification</th>
                  <th className="py-0 px-4 bg-[#F6F7F5]">Reporting Manager</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E6E1] bg-white text-[#1F2933]">
                {reportData.absenteeism.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#7B8794]">
                      No absenteeism incidents recorded.
                    </td>
                  </tr>
                ) : (
                  reportData.absenteeism.map((row) => (
                    <tr key={row.id} className="h-[48px] hover:bg-[#FAFAF8] transition-colors">
                      <td className="py-0 px-4 align-middle font-medium text-[#1F2933]">
                        <div className="flex items-center gap-2">
                          <Avatar name={row.name} size="xs" />
                          <div>
                            <span className="block font-medium">{row.name}</span>
                            <span className="text-xs text-[#7B8794] font-mono">{row.employee_code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-0 px-4 align-middle text-[#52606D]">{row.department}</td>
                      <td className="py-0 px-4 align-middle text-[#1F2933] font-mono">{row.date}</td>
                      <td className="py-0 px-4 align-middle">
                        <StatusPill variant="bad">{row.type}</StatusPill>
                      </td>
                      <td className="py-0 px-4 align-middle text-[#52606D]">{row.reporting_manager}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-[#F6F7F5] border-b border-[#E4E6E1] text-[#7B8794] font-semibold text-[12px] normal-case tracking-normal h-[40px] sticky top-0">
                <tr className="h-[40px]">
                  <th className="py-0 px-4 bg-[#F6F7F5]">Employee</th>
                  <th className="py-0 px-4 bg-[#F6F7F5]">Department</th>
                  <th className="py-0 px-4 bg-[#F6F7F5] text-right">Target Expected Hours</th>
                  <th className="py-0 px-4 bg-[#F6F7F5] text-right">Logged Work Hours</th>
                  <th className="py-0 px-4 bg-[#F6F7F5] text-right">Variance</th>
                  <th className="py-0 px-4 bg-[#F6F7F5]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E6E1] bg-white text-[#1F2933]">
                {reportData.workingHours.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#7B8794]">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  reportData.workingHours.map((row) => (
                    <tr key={row.employee_code} className="h-[48px] hover:bg-[#FAFAF8] transition-colors">
                      <td className="py-0 px-4 align-middle font-medium text-[#1F2933]">
                        <div className="flex items-center gap-2">
                          <Avatar name={row.name} size="xs" />
                          <div>
                            <span className="block font-medium">{row.name}</span>
                            <span className="text-xs text-[#7B8794] font-mono">{row.employee_code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-0 px-4 align-middle text-[#52606D]">{row.department}</td>
                      <td className="py-0 px-4 align-middle text-right font-mono text-[#52606D]">{row.expected_hours.toFixed(1)}h</td>
                      <td className="py-0 px-4 align-middle text-right font-mono font-semibold text-[#1F2933]">{row.logged_hours.toFixed(1)}h</td>
                      <td className="py-0 px-4 align-middle text-right font-mono">
                        <span
                          className={`font-semibold ${
                            row.difference_hours >= 0 ? "text-[#1E6B45]" : "text-[#A12D22]"
                          }`}
                        >
                          {row.difference_hours >= 0 ? `+${row.difference_hours.toFixed(1)}h` : `${row.difference_hours.toFixed(1)}h`}
                        </span>
                      </td>
                      <td className="py-0 px-4 align-middle">
                        <StatusPill
                          variant={row.status === "Target Met" ? "ok" : row.status === "Overtime" ? "leave" : "warn"}
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
