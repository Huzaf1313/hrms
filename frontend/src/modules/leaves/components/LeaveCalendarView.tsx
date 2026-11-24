import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  User,
  Building2,
} from "lucide-react";
import { getLeaveTypeMeta } from "../services/leaveTypes";
import type { MockTeamLeave, MockHoliday } from "../../../services/mock/leaveMockService";

export interface LeaveCalendarViewProps {
  teamLeaves: MockTeamLeave[];
  holidays: MockHoliday[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

function formatDateRange(startStr: string, endStr: string): string {
  if (!startStr) return "-";
  if (!endStr || startStr === endStr) return formatSimpleDate(startStr);
  const sParts = startStr.slice(0, 10).split("-");
  const eParts = endStr.slice(0, 10).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (sParts.length === 3 && eParts.length === 3) {
    const sDay = parseInt(sParts[2], 10);
    const sMonth = months[parseInt(sParts[1], 10) - 1];
    const sYear = sParts[0];

    const eDay = parseInt(eParts[2], 10);
    const eMonth = months[parseInt(eParts[1], 10) - 1];
    const eYear = eParts[0];

    if (sYear === eYear) {
      return `${sDay} ${sMonth} - ${eDay} ${eMonth} ${sYear}`;
    }
    return `${sDay} ${sMonth} ${sYear} - ${eDay} ${eMonth} ${eYear}`;
  }
  return `${startStr} - ${endStr}`;
}

function formatSimpleDate(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length !== 3) return dateStr;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
}

export const LeaveCalendarView: React.FC<LeaveCalendarViewProps> = ({
  teamLeaves = [],
  holidays = [],
  isLoading = false,
  error = null,
  onRetry,
  className = "",
}) => {
  // Default to today (Nov 24, 2026 in production mock environment)
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Popover state for individual leave details
  const [activeLeaveDetails, setActiveLeaveDetails] = useState<{
    leave: MockTeamLeave;
    x: number;
    y: number;
  } | null>(null);

  // Modal state for "+N more" leaves on a specific day
  const [selectedDayModal, setSelectedDayModal] = useState<{
    dateKey: string;
    formattedDate: string;
    leaves: MockTeamLeave[];
    holiday?: MockHoliday;
  } | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Close details popover on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActiveLeaveDetails(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveLeaveDetails(null);
        setSelectedDayModal(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Reference for "today"
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [today]);

  const monthLabel = currentDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const jumpToToday = () => setCurrentDate(new Date());

  // Filtered leaves (including approved and pending, matching filters)
  const filteredLeaves = useMemo(() => {
    return teamLeaves.filter((l) => {
      const matchDept = departmentFilter === "all" || l.department_name === departmentFilter;
      const matchType = typeFilter === "all" || l.leave_type === typeFilter;
      const matchStatus = l.status === "approved" || l.status === "pending";
      return matchDept && matchType && matchStatus;
    });
  }, [teamLeaves, departmentFilter, typeFilter]);

  // Check if current month has any leaves
  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthHasLeaves = useMemo(() => {
    return filteredLeaves.some(
      (l) =>
        (l.start_date.slice(0, 7) === currentMonthPrefix ||
          l.end_date.slice(0, 7) === currentMonthPrefix ||
          (l.start_date <= currentMonthPrefix && l.end_date >= currentMonthPrefix))
    );
  }, [filteredLeaves, currentMonthPrefix]);

  // Holidays map for fast O(1) lookup
  const holidayMap = useMemo(() => {
    const map = new Map<string, MockHoliday>();
    holidays.forEach((h) => map.set(h.date, h));
    return map;
  }, [holidays]);

  // Calendar matrix calculation with trailing previous month and leading next month days
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    interface CalendarCell {
      dayNumber: number;
      dateKey: string;
      isCurrentMonth: boolean;
      isWeekend: boolean;
      isToday: boolean;
    }

    const cells: CalendarCell[] = [];

    // Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthTotalDays - i;
      const prevMonthDate = new Date(year, month - 1, dayNum);
      const prevYear = prevMonthDate.getFullYear();
      const prevM = String(prevMonthDate.getMonth() + 1).padStart(2, "0");
      const prevD = String(dayNum).padStart(2, "0");
      const dateKey = `${prevYear}-${prevM}-${prevD}`;
      const dayOfWeek = prevMonthDate.getDay();

      cells.push({
        dayNumber: dayNum,
        dateKey,
        isCurrentMonth: false,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: dateKey === todayKey,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeek = new Date(year, month, d).getDay();

      cells.push({
        dayNumber: d,
        dateKey,
        isCurrentMonth: true,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: dateKey === todayKey,
      });
    }

    // Next month leading days to complete 35 or 42 grid cells
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonthDate = new Date(year, month + 1, d);
      const nextYear = nextMonthDate.getFullYear();
      const nextM = String(nextMonthDate.getMonth() + 1).padStart(2, "0");
      const nextD = String(d).padStart(2, "0");
      const dateKey = `${nextYear}-${nextM}-${nextD}`;
      const dayOfWeek = nextMonthDate.getDay();

      cells.push({
        dayNumber: d,
        dateKey,
        isCurrentMonth: false,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: dateKey === todayKey,
      });
    }

    return cells;
  }, [year, month, todayKey]);

  return (
    <div
      className={`rounded-lg bg-white border border-[#E5E7EB] shadow-none overflow-hidden ${className}`}
    >
      {/* Month Header and Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-b border-[#E5E7EB] bg-white">
        {/* Navigation Group */}
        <div className="flex items-center gap-3">
          <h3 className="text-[15px] font-semibold text-[#111827] min-w-[130px]">{monthLabel}</h3>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prevMonth}
              className="h-7 w-7 flex items-center justify-center rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#4B5563] focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] transition-colors cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="h-7 w-7 flex items-center justify-center rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#4B5563] focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] transition-colors cursor-pointer"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
            <button
              type="button"
              onClick={jumpToToday}
              className="h-7 px-2.5 text-[12px] font-medium rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] text-[#4B5563] focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] transition-colors cursor-pointer ml-1"
              aria-label="Jump to current month"
            >
              Today
            </button>
          </div>
        </div>

        {/* Filters Row (32px standard height) */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="h-8 px-2.5 text-[12px] rounded-md border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] cursor-pointer"
            aria-label="Filter by department"
          >
            <option value="all">All Departments</option>
            <option value="Engineering">Engineering</option>
            <option value="Product & Design">Product & Design</option>
            <option value="Human Resources">Human Resources</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 px-2.5 text-[12px] rounded-md border border-[#E5E7EB] bg-white text-[#111827] focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] cursor-pointer"
            aria-label="Filter by leave type"
          >
            <option value="all">All Leave Types</option>
            <option value="Casual Leave">Casual Leave</option>
            <option value="Sick Leave">Sick Leave</option>
            <option value="Earned Leave">Earned Leave</option>
            <option value="Comp Off">Comp Off</option>
            <option value="Unpaid Leave">Unpaid Leave</option>
          </select>
        </div>
      </div>

      {/* Main Calendar Body */}
      <div className="p-4">
        {/* Error State */}
        {error ? (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-[#F8B4B4] bg-[#FDF2F2] p-4 text-[#9B1C1C]">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>Failed to load team leave calendar: {error}</span>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="h-8 px-3 rounded-md bg-[#DC2626] text-xs font-semibold text-white hover:bg-[#B91C1C] transition cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        ) : null}

        {/* Empty-Month State Notice */}
        {!isLoading && !monthHasLeaves && (
          <div className="mb-3 flex items-center justify-between px-4 py-2.5 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] text-[12px] text-[#4B5563]">
            <span className="flex items-center gap-1.5 font-medium">
              <CalendarDays className="w-4 h-4 text-[#6B7280]" />
              No leaves scheduled this month matching the selected filters.
            </span>
            {(departmentFilter !== "all" || typeFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setDepartmentFilter("all");
                  setTypeFilter("all");
                }}
                className="text-[11px] font-semibold text-[#2F5FD0] hover:underline cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Scrollable grid container for small screens */}
        <div className="w-full overflow-x-auto">
          <div className="min-w-[720px]">
            {/* Weekday Header Row */}
            <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="px-2 py-1 text-left">
                  {day}
                </div>
              ))}
            </div>

            {/* Loading Skeleton */}
            {isLoading ? (
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[104px] rounded-[6px] border border-[#E5E7EB] bg-[#F9FAFB] p-2 animate-pulse"
                  >
                    <div className="h-4 w-6 rounded bg-[#E5E7EB] mb-2" />
                    <div className="h-5 w-full rounded bg-[#E5E7EB]/80 mb-1" />
                    <div className="h-5 w-3/4 rounded bg-[#E5E7EB]/60" />
                  </div>
                ))}
              </div>
            ) : (
              /* Calendar Grid (Uniform 104px Height) */
              <div className="grid grid-cols-7 gap-1.5">
                {calendarCells.map((cell) => {
                  const dayHoliday = holidayMap.get(cell.dateKey);
                  const dayLeaves = cell.isCurrentMonth
                    ? filteredLeaves.filter(
                        (l) => cell.dateKey >= l.start_date && cell.dateKey <= l.end_date
                      )
                    : [];

                  // Visible chips limit: max 2
                  const visibleLeaves = dayLeaves.slice(0, 2);
                  const overflowCount = dayLeaves.length - 2;

                  // Determine cell container styling
                  let cellClasses =
                    "h-[104px] min-h-[104px] max-h-[104px] p-2 rounded-[6px] border flex flex-col justify-between transition-colors overflow-hidden ";

                  if (cell.isToday) {
                    cellClasses += "bg-[#EFF6FF] border-[#BFDBFE] ring-1 ring-[#2F5FD0]/20";
                  } else if (dayHoliday && cell.isCurrentMonth) {
                    cellClasses += "bg-[#FFFDF5] border-[#FDE68A]";
                  } else if (cell.isWeekend) {
                    cellClasses += "bg-[#F9FAFB] border-[#E5E7EB]";
                  } else if (!cell.isCurrentMonth) {
                    cellClasses += "bg-[#F9FAFB]/50 border-[#E5E7EB]/60";
                  } else {
                    cellClasses += "bg-white border-[#E5E7EB]";
                  }

                  return (
                    <div key={cell.dateKey} className={cellClasses}>
                      {/* Top Row: Date Number + Holiday Tag */}
                      <div className="flex items-center justify-between gap-1 leading-none">
                        {cell.isToday ? (
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2F5FD0] text-[11px] font-semibold text-white shadow-xs"
                            title="Today (24 Nov 2026)"
                          >
                            {cell.dayNumber}
                          </span>
                        ) : (
                          <span
                            className={`text-[12px] font-medium ${
                              !cell.isCurrentMonth
                                ? "text-[#9CA3AF]"
                                : cell.isWeekend
                                ? "text-[#6B7280]"
                                : "text-[#111827]"
                            }`}
                          >
                            {cell.dayNumber}
                          </span>
                        )}

                        {/* Holiday Tag */}
                        {dayHoliday && cell.isCurrentMonth && (
                          <span
                            className="text-[10px] font-medium text-[#92400E] bg-[#FEF3C7] border border-[#FCD34D] px-1.5 py-0.5 rounded truncate max-w-[105px] leading-tight"
                            title={dayHoliday.name}
                          >
                            {dayHoliday.name}
                          </span>
                        )}
                      </div>

                      {/* Middle/Bottom: Leave Chips (Max 2 + overflow link) */}
                      <div className="mt-1 space-y-1 overflow-hidden">
                        {visibleLeaves.map((l) => {
                          const meta = getLeaveTypeMeta(l.leave_type);
                          const isPending = l.status === "pending";

                          return (
                            <button
                              key={l.id}
                              type="button"
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActiveLeaveDetails({
                                  leave: l,
                                  x: Math.min(window.innerWidth - 260, Math.max(16, rect.left)),
                                  y: rect.bottom + 6,
                                });
                              }}
                              className={`w-full h-[21px] px-1.5 py-0 rounded-[4px] text-[11px] font-medium truncate flex items-center gap-1.5 text-left transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] ${
                                isPending
                                  ? "border border-dashed border-[#F59E0B] bg-white/95 text-[#92400E]"
                                  : "border border-transparent"
                              }`}
                              style={
                                !isPending
                                  ? {
                                      backgroundColor: meta.accentBg,
                                      color: meta.accent,
                                      borderColor: `${meta.accent}30`,
                                    }
                                  : undefined
                              }
                              title={`${l.employee_name} • ${l.leave_type} (${l.status})`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  isPending ? "bg-[#F59E0B]" : ""
                                }`}
                                style={!isPending ? { backgroundColor: meta.accent } : undefined}
                              />
                              <span className="truncate flex-1">{l.employee_name}</span>
                              {isPending && (
                                <span className="text-[9px] font-semibold text-[#92400E] bg-[#FEF3C7] px-1 rounded shrink-0">
                                  Pending
                                </span>
                              )}
                            </button>
                          );
                        })}

                        {/* Overflow "+N more" button */}
                        {overflowCount > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedDayModal({
                                dateKey: cell.dateKey,
                                formattedDate: formatSimpleDate(cell.dateKey),
                                leaves: dayLeaves,
                                holiday: dayHoliday,
                              })
                            }
                            className="text-[11px] font-semibold text-[#2F5FD0] hover:underline focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] rounded px-0.5 text-left cursor-pointer block leading-none pt-0.5"
                          >
                            +{overflowCount} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Compact Legend Row */}
        <div className="mt-4 pt-3 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-y-2 gap-x-6 text-[11px] text-[#4B5563]">
          {/* Leave Type Color Dots */}
          <div className="flex items-center gap-3.5 flex-wrap">
            <span className="font-semibold text-[#111827]">Leave Types:</span>
            {[
              { label: "Casual", color: "#2F5FD0" },
              { label: "Sick", color: "#C2410C" },
              { label: "Earned", color: "#1E6B45" },
              { label: "Comp Off", color: "#6D4AB5" },
              { label: "Unpaid", color: "#7B8794" },
            ].map((t) => (
              <span key={t.label} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <span>{t.label}</span>
              </span>
            ))}
          </div>

          {/* Status & Date Visual Indicators */}
          <div className="flex items-center gap-3.5 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-[2px] bg-[#E3F3EA] border border-[#1E6B45]/40" />
              <span>Approved</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-[2px] bg-white border border-dashed border-[#F59E0B]" />
              <span>Pending</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="px-1 py-0.2 rounded text-[9px] font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
                Holiday
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-[2px] bg-[#F9FAFB] border border-[#E5E7EB]" />
              <span>Weekend</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#2F5FD0] text-white flex items-center justify-center text-[8px] font-bold">
                •
              </span>
              <span>Today</span>
            </span>
          </div>
        </div>
      </div>

      {/* Floating Popover: Individual Leave Details */}
      {activeLeaveDetails && (
        <div
          ref={popoverRef}
          className="fixed z-50 w-72 rounded-lg border border-[#E5E7EB] bg-white p-3.5 shadow-xl transition-all"
          style={{
            left: `${activeLeaveDetails.x}px`,
            top: `${activeLeaveDetails.y}px`,
          }}
        >
          <div className="flex items-start justify-between gap-2 border-b border-[#E5E7EB] pb-2 mb-2.5">
            <div className="min-w-0">
              <h4 className="text-[13px] font-semibold text-[#111827] truncate flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                {activeLeaveDetails.leave.employee_name}
              </h4>
              <p className="text-[11px] text-[#6B7280] flex items-center gap-1 mt-0.5 truncate">
                <Building2 className="w-3 h-3 text-[#9CA3AF] shrink-0" />
                {activeLeaveDetails.leave.department_name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveLeaveDetails(null)}
              className="text-[#9CA3AF] hover:text-[#4B5563] p-0.5 rounded cursor-pointer"
              aria-label="Close details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-[#6B7280]">Leave Type:</span>
              <span
                className="font-medium px-2 py-0.5 rounded text-[11px]"
                style={{
                  backgroundColor: getLeaveTypeMeta(activeLeaveDetails.leave.leave_type).accentBg,
                  color: getLeaveTypeMeta(activeLeaveDetails.leave.leave_type).accent,
                }}
              >
                {activeLeaveDetails.leave.leave_type}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#6B7280]">Date Range:</span>
              <span className="font-medium text-[#111827]">
                {formatDateRange(
                  activeLeaveDetails.leave.start_date,
                  activeLeaveDetails.leave.end_date
                )}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#6B7280]">Working Days:</span>
              <span className="font-medium text-[#111827] tabular-nums">
                {activeLeaveDetails.leave.total_days}{" "}
                {activeLeaveDetails.leave.total_days === 1 ? "working day" : "working days"}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#E5E7EB]">
              <span className="text-[#6B7280]">Status:</span>
              {activeLeaveDetails.leave.status === "approved" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]">
                  <CheckCircle2 className="w-3 h-3" />
                  Approved
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
                  <Clock className="w-3 h-3" />
                  Pending Review
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Popover / Modal: Full Day Leaves ("+N more") */}
      {selectedDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded border border-[#E5E7EB] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3 mb-3">
              <div>
                <h3 className="text-[15px] font-semibold text-[#111827]">
                  Leaves on {selectedDayModal.formattedDate}
                </h3>
                <p className="text-[12px] text-[#6B7280] mt-0.5">
                  {selectedDayModal.leaves.length}{" "}
                  {selectedDayModal.leaves.length === 1 ? "employee" : "employees"} scheduled off
                  {selectedDayModal.holiday ? ` • ${selectedDayModal.holiday.name}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayModal(null)}
                className="text-[#9CA3AF] hover:text-[#4B5563] p-1 rounded border border-[#E5E7EB] cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {selectedDayModal.leaves.map((l) => {
                const meta = getLeaveTypeMeta(l.leave_type);
                const isPending = l.status === "pending";

                return (
                  <div
                    key={l.id}
                    className="p-3 rounded border border-[#E5E7EB] bg-[#F9FAFB] flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[#111827]">
                        {l.employee_name}
                      </span>
                      {isPending ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
                          Pending
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]">
                          Approved
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[12px] text-[#6B7280]">
                      <span>{l.department_name}</span>
                      <span
                        className="font-medium px-2 py-0.2 rounded text-[11px]"
                        style={{ backgroundColor: meta.accentBg, color: meta.accent }}
                      >
                        {l.leave_type}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#6B7280] pt-1 border-t border-[#E5E7EB]">
                      <span>{formatDateRange(l.start_date, l.end_date)}</span>
                      <span className="font-medium text-[#111827]">
                        {l.total_days} {l.total_days === 1 ? "day" : "days"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-[#E5E7EB] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDayModal(null)}
                className="h-8 px-4 rounded border border-[#E5E7EB] bg-white text-[12px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveCalendarView;
