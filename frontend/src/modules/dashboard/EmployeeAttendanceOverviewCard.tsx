import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck } from "lucide-react";

import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import {
  useEmployeeLeaves,
  type LeaveRequest,
} from "../../hooks/useEmployeeData";
import { queryKeys } from "../../lib/queryKeys";
import { employeeAttendance } from "../attendance/attendanceService";
import type { EmployeeAttendanceRecord } from "../attendance/types";
import { employeeService } from "../employees/employeeService";
import { holidayService } from "../holidays/holidayService";
import {
  DAY_STATUS_LABELS,
  getMonthBounds,
  getMonthOptions,
  getMonthlyAttendanceSummary,
  pad2,
  type DayAttendanceStatus,
  type MonthlyAttendanceDay,
} from "./attendanceOverviewUtils";

interface EmployeeAttendanceOverviewCardProps {
  employeeId?: string | null;
  leaveRequests?: LeaveRequest[];
  loadingLeaves?: boolean;
  hasLeaveError?: boolean;
  today?: Date;
}

const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const HEATMAP_CELL_STYLES: Record<DayAttendanceStatus, string> = {
  present:
    "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300",
  late:
    "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-300",
  on_leave:
    "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/60 dark:text-blue-300",
  absent:
    "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/60 dark:text-rose-300",
  weekend:
    "border-slate-200/70 bg-slate-100 text-slate-400 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-500",
  holiday:
    "border-slate-200/70 bg-slate-100 text-slate-400 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-500",
  future:
    "border-slate-200/70 bg-slate-100 text-slate-400 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-500",
  before_joining:
    "border-slate-200/70 bg-slate-100 text-slate-400 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-500",
  today_pending:
    "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
};

function formatDayTooltipDate(dateKey: string): string {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDayStatusDetail(day: MonthlyAttendanceDay): string {
  if (day.status === "holiday" && day.holidayName) {
    return `Holiday: ${day.holidayName}`;
  }
  if (day.status === "on_leave" && day.leaveType) {
    return `On Leave (${day.leaveType})`;
  }
  return DAY_STATUS_LABELS[day.status];
}

function getNativeTitle(day: MonthlyAttendanceDay): string {
  const dateLabel = formatDayTooltipDate(day.dateKey);
  const statusDetail = getDayStatusDetail(day);
  const times =
    day.inTime || day.outTime
      ? ` — In: ${day.inTime ?? "--"} · Out: ${day.outTime ?? "--"}`
      : "";
  return `${dateLabel}: ${statusDetail}${times}`;
}

export default function EmployeeAttendanceOverviewCard({
  employeeId,
  leaveRequests: externalLeaveRequests,
  loadingLeaves: externalLoadingLeaves,
  hasLeaveError: externalHasLeaveError,
  today,
}: EmployeeAttendanceOverviewCardProps) {
  const now = useMemo(() => today ?? new Date(), [today]);
  const monthOptions = useMemo(() => getMonthOptions(now, 11), [now]);
  const [selectedMonth, setSelectedMonth] = useState(
    () => `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`,
  );

  const [selectedYear, selectedMonthNum] = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    return [y || now.getFullYear(), m || now.getMonth() + 1];
  }, [selectedMonth, now]);

  const bounds = useMemo(
    () => getMonthBounds(selectedYear, selectedMonthNum),
    [selectedYear, selectedMonthNum],
  );

  // Fetch selected month's attendance records
  const {
    data: monthAttendance = [],
    isLoading: loadingAttendance,
    isError: attendanceError,
    refetch: refetchAttendance,
  } = useQuery<EmployeeAttendanceRecord[]>({
    queryKey: queryKeys.employee.attendance(employeeId || "", {
      startDate: bounds.startDate,
      endDate: bounds.endDate,
    }),
    queryFn: () =>
      employeeAttendance.month(
        employeeId as string,
        bounds.startDate,
        bounds.endDate,
      ),
    enabled: Boolean(employeeId),
    staleTime: 60 * 1000,
  });

  // Reuse leaves from hook only if not passed in from parent
  const internalLeavesQuery = useEmployeeLeaves(
    externalLeaveRequests ? undefined : employeeId,
  );
  const leaveRequests = useMemo(
    () => externalLeaveRequests ?? internalLeavesQuery.data?.items ?? [],
    [externalLeaveRequests, internalLeavesQuery.data?.items],
  );
  const loadingLeaves =
    externalLoadingLeaves ??
    (!externalLeaveRequests && internalLeavesQuery.isLoading);
  const hasLeaveError =
    externalHasLeaveError ??
    (!externalLeaveRequests && internalLeavesQuery.isError);

  // Fetch employee's own profile (for joining_date and department_id)
  const { data: myProfile } = useQuery({
    queryKey: ["employee", employeeId || "", "profile"],
    queryFn: async () => {
      try {
        return await employeeService.getMyProfile();
      } catch {
        return null;
      }
    },
    enabled: Boolean(employeeId),
    staleTime: 10 * 60 * 1000,
  });

  // Fetch holidays for the selected month
  const { data: holidays = [] } = useQuery({
    queryKey: [
      ...queryKeys.reference.holidays(),
      {
        startDate: bounds.startDate,
        endDate: bounds.endDate,
        departmentId: myProfile?.department_id ?? "",
      },
    ],
    queryFn: async () => {
      try {
        return await holidayService.list({
          start_date: bounds.startDate,
          end_date: bounds.endDate,
          department_id: myProfile?.department_id,
        });
      } catch {
        return [];
      }
    },
    enabled: Boolean(employeeId),
    staleTime: 5 * 60 * 1000,
  });

  const summary = useMemo(
    () =>
      getMonthlyAttendanceSummary({
        year: selectedYear,
        month: selectedMonthNum,
        today: now,
        attendanceRecords: monthAttendance,
        leaveRequests,
        holidays,
        joiningDate: myProfile?.joining_date ?? null,
      }),
    [
      selectedYear,
      selectedMonthNum,
      now,
      monthAttendance,
      leaveRequests,
      holidays,
      myProfile?.joining_date,
    ],
  );

  const isLoading = Boolean(employeeId) && (loadingAttendance || loadingLeaves);
  const isError = Boolean(employeeId) && (attendanceError || hasLeaveError);

  const hasAnyActiveDayInMonth = summary.days.some(
    (day) =>
      day.isToday ||
      day.status === "present" ||
      day.status === "late" ||
      day.status === "on_leave" ||
      day.status === "absent" ||
      day.status === "today_pending",
  );

  const summaryItems = [
    {
      label: "Present",
      count: summary.counts.present,
      percent: summary.percentages.present,
      dotClass: "bg-emerald-500",
      cardClass:
        "bg-emerald-50/80 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/50",
      labelClass: "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "Late",
      count: summary.counts.late,
      percent: summary.percentages.late,
      dotClass: "bg-amber-500",
      cardClass:
        "bg-amber-50/80 border-amber-100 dark:bg-amber-950/30 dark:border-amber-900/50",
      labelClass: "text-amber-700 dark:text-amber-300",
    },
    {
      label: "On Leave",
      count: summary.counts.on_leave,
      percent: summary.percentages.on_leave,
      dotClass: "bg-blue-500",
      cardClass:
        "bg-blue-50/80 border-blue-100 dark:bg-blue-950/30 dark:border-blue-900/50",
      labelClass: "text-blue-700 dark:text-blue-300",
    },
    {
      label: "Absent",
      count: summary.counts.absent,
      percent: summary.percentages.absent,
      dotClass: "bg-rose-500",
      cardClass:
        "bg-rose-50/80 border-rose-100 dark:bg-rose-950/30 dark:border-rose-900/50",
      labelClass: "text-rose-700 dark:text-rose-300",
    },
  ];

  return (
    <div className="col-span-12 flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-5 lg:col-span-8 dark:border-slate-800 dark:bg-slate-900">
      {/* Header + Month Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-[#2563EB] dark:text-blue-400" />
            <h2 className="text-[14px] font-semibold text-[#111827] dark:text-slate-100">
              Attendance Overview
            </h2>
          </div>
          <p className="mt-0.5 text-[12px] text-[#6B7280] dark:text-slate-400">
            Monthly daily attendance for {summary.monthLabel}
          </p>
        </div>

        <Select
          aria-label="Select attendance month"
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          wrapperClassName="w-full sm:w-[175px]"
          className="h-9 text-[12px] font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          options={monthOptions}
        />
      </div>

      {/* Body */}
      <div className="mt-4 flex flex-1 flex-col justify-between">
        {!employeeId ? (
          <EmptyState
            icon={<CalendarCheck className="h-4 w-4" />}
            title="No employee profile linked"
            description="Your monthly attendance calendar will appear once an employee ID is linked to your account."
            className="max-w-none py-8"
          />
        ) : isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {Array.from({ length: 35 }).map((_, index) => (
                <Skeleton key={index} className="h-8 rounded-lg sm:h-9" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-14 rounded-lg" />
              ))}
            </div>
          </div>
        ) : isError ? (
          <ErrorState
            title="Could not load attendance overview"
            message="Please check your connection and try again."
            onRetry={() => {
              void refetchAttendance();
              if (!externalLeaveRequests) {
                void internalLeavesQuery.refetch();
              }
            }}
            className="max-w-none py-8"
          />
        ) : !hasAnyActiveDayInMonth ? (
          <EmptyState
            icon={<CalendarCheck className="h-4 w-4" />}
            title={`No attendance data for ${summary.monthLabel}`}
            description="There are no elapsed working days recorded for this month."
            className="max-w-none py-8"
          />
        ) : (
          <>
            {/* Calendar Heatmap */}
            <div>
              {/* Weekday Headers (Mon - Sun) */}
              <div className="mb-1.5 grid grid-cols-7 gap-1.5 sm:gap-2">
                {WEEKDAY_HEADERS.map((weekday) => (
                  <div
                    key={weekday}
                    className="text-center text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] dark:text-slate-400"
                  >
                    {weekday}
                  </div>
                ))}
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {Array.from({ length: summary.leadingEmptyDays }).map((_, idx) => (
                  <div
                    key={`empty-${idx}`}
                    className="h-8 sm:h-9"
                    aria-hidden="true"
                  />
                ))}

                {summary.days.map((day) => {
                  const statusDetail = getDayStatusDetail(day);
                  const todayRingClass = day.isToday
                    ? "ring-2 ring-[#2563EB] ring-offset-1 dark:ring-blue-400 dark:ring-offset-slate-900"
                    : "";

                  return (
                    <div key={day.dateKey} className="group relative">
                      <button
                        type="button"
                        title={getNativeTitle(day)}
                        aria-label={getNativeTitle(day)}
                        className={`flex h-8 w-full items-center justify-center rounded-lg border text-[11px] font-semibold transition sm:h-9 sm:text-xs ${HEATMAP_CELL_STYLES[day.status]} ${todayRingClass}`}
                      >
                        {day.day}
                      </button>

                      {/* Hover / Focus Tooltip */}
                      <div
                        role="tooltip"
                        className={`pointer-events-none absolute bottom-full z-30 mb-1.5 hidden w-max max-w-[210px] rounded-lg border border-slate-200 bg-slate-900 px-2.5 py-1.5 text-left text-[11px] text-white shadow-lg group-hover:block group-focus-within:block dark:border-slate-700 dark:bg-slate-800 ${
                          day.dayOfWeek === 1
                            ? "left-0"
                            : day.dayOfWeek === 0
                              ? "right-0"
                              : "left-1/2 -translate-x-1/2"
                        }`}
                      >
                        <p className="font-semibold">
                          {formatDayTooltipDate(day.dateKey)}
                        </p>
                        <p className="mt-0.5 text-slate-200">{statusDetail}</p>
                        {(day.inTime || day.outTime) && (
                          <p className="mt-0.5 text-slate-300">
                            In: {day.inTime ?? "--"} · Out: {day.outTime ?? "--"}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {monthAttendance.length === 0 && summary.counts.on_leave === 0 && (
                <p className="mt-2.5 text-[12px] text-[#6B7280] dark:text-slate-400">
                  No punch records logged for {summary.monthLabel} yet.
                </p>
              )}
            </div>

            {/* Working days line + Summary Cards (acting as legend) */}
            <div className="mt-4 border-t border-[#E5E7EB] pt-3 dark:border-slate-800">
              <p className="mb-2.5 text-[12px] font-medium text-[#6B7280] dark:text-slate-400">
                Working days so far:{" "}
                <span className="font-semibold text-[#111827] dark:text-slate-100">
                  {summary.workingDaysElapsed}
                </span>
              </p>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {summaryItems.map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-lg border px-3 py-2 ${item.cardClass}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${item.dotClass}`}
                        aria-hidden="true"
                      />
                      <p className={`text-[11px] font-medium ${item.labelClass}`}>
                        {item.label}
                      </p>
                    </div>
                    <p className="mt-1 text-[13px] font-semibold text-[#111827] dark:text-slate-100">
                      {item.count}d ({item.percent}%)
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
