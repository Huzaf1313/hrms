import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select } from "../../../components/ui/Select";
import { getLeaveTypeMeta } from "../services/leaveTypes";
import type { MockTeamLeave, MockHoliday } from "../../../services/mock/leaveMockService";

export interface LeaveCalendarViewProps {
  teamLeaves: MockTeamLeave[];
  holidays: MockHoliday[];
  className?: string;
}

export const LeaveCalendarView: React.FC<LeaveCalendarViewProps> = ({
  teamLeaves,
  holidays,
  className = "",
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthLabel = currentDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));

  // Filtered leaves
  const filteredLeaves = useMemo(() => {
    return teamLeaves.filter((l) => {
      const matchDept = departmentFilter === "all" || l.department_name === departmentFilter;
      const matchType = typeFilter === "all" || l.leave_type === typeFilter;
      return matchDept && matchType && l.status === "approved";
    });
  }, [teamLeaves, departmentFilter, typeFilter]);

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: Array<{ dayNumber: number | null; dateKey: string; isWeekend: boolean }> = [];

    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNumber: null, dateKey: `blank-${i}`, isWeekend: false });
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeek = new Date(year, month, d).getDay();
      days.push({
        dayNumber: d,
        dateKey,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      });
    }

    return days;
  }, [year, month]);

  // Holidays map
  const holidayMap = useMemo(() => {
    const map = new Map<string, MockHoliday>();
    holidays.forEach((h) => map.set(h.date, h));
    return map;
  }, [holidays]);

  return (
    <div className={`rounded-[8px] bg-white border border-[#E4E6E1] overflow-hidden shadow-none ${className}`}>
      {/* Top Header & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#E4E6E1] bg-white">
        <div className="flex items-center gap-3">
          <h3 className="text-[14px] font-semibold text-[#1F2933]">{monthLabel}</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-[4px] border border-[#E4E6E1] bg-white hover:bg-[#F0F1EE] text-[#52606D] transition-colors cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-[4px] border border-[#E4E6E1] bg-white hover:bg-[#F0F1EE] text-[#52606D] transition-colors cursor-pointer"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="h-[34px] text-[13.5px] w-40"
            wrapperClassName="w-auto"
          >
            <option value="all">All Departments</option>
            <option value="Engineering">Engineering</option>
            <option value="Product & Design">Product & Design</option>
            <option value="Human Resources">Human Resources</option>
          </Select>

          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-[34px] text-[13.5px] w-36"
            wrapperClassName="w-auto"
          >
            <option value="all">All Leave Types</option>
            <option value="Casual Leave">Casual Leave</option>
            <option value="Sick Leave">Sick Leave</option>
            <option value="Earned Leave">Earned Leave</option>
            <option value="Comp Off">Comp Off</option>
          </Select>
        </div>
      </div>

      {/* Calendar Matrix */}
      <div className="p-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 text-center text-[12px] font-semibold text-[#7B8794] uppercase tracking-wider mb-2">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {calendarDays.map((item, index) => {
            if (item.dayNumber === null) {
              return <div key={item.dateKey || index} className="min-h-[90px] bg-[#F6F7F5]/40 rounded-[6px] border border-transparent" />;
            }

            const dayHoliday = holidayMap.get(item.dateKey);
            const dayLeaves = filteredLeaves.filter(
              (l) => item.dateKey >= l.start_date && item.dateKey <= l.end_date
            );

            return (
              <div
                key={item.dateKey}
                className={`min-h-[96px] p-2 rounded-[6px] border flex flex-col justify-between transition-colors ${
                  item.isWeekend
                    ? "bg-[#F6F7F5] border-[#E4E6E1]"
                    : "bg-white border-[#E4E6E1]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[12px] font-medium ${
                      item.isWeekend ? "text-[#7B8794]" : "text-[#1F2933]"
                    }`}
                  >
                    {item.dayNumber}
                  </span>
                  {dayHoliday && (
                    <span className="text-xs font-medium text-[#C2410C] bg-[#FFEDD5] px-1 rounded truncate max-w-[80px]" title={dayHoliday.name}>
                      Holiday
                    </span>
                  )}
                </div>

                {/* Leaves chips */}
                <div className="mt-1 space-y-1 overflow-y-auto max-h-[58px]">
                  {dayLeaves.map((l) => {
                    const meta = getLeaveTypeMeta(l.leave_type);
                    return (
                      <div
                        key={l.id}
                        className="px-1.5 py-0.5 rounded text-xs truncate flex items-center gap-1 font-medium"
                        style={{
                          backgroundColor: meta.accentBg,
                          color: meta.accent,
                        }}
                        title={`${l.employee_name} - ${l.leave_type}`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: meta.accent }}
                        />
                        <span className="truncate">{l.employee_name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LeaveCalendarView;
