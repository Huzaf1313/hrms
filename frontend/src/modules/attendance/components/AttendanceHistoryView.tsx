import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar, List } from "lucide-react";
import { StatusPill } from "../../../components/ui/Badge";
import type { EmployeeAttendanceRecord } from "../types";

export interface AttendanceHistoryViewProps {
  records: EmployeeAttendanceRecord[];
  onSelectDay: (record: EmployeeAttendanceRecord) => void;
  onRequestRegularization?: (record: EmployeeAttendanceRecord) => void;
  className?: string;
}

export const AttendanceHistoryView: React.FC<AttendanceHistoryViewProps> = ({
  records,
  onSelectDay,
  onRequestRegularization,
  className = "",
}) => {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthLabel = currentDate.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));

  // Map of records by day string "YYYY-MM-DD"
  const recordMap = useMemo(() => {
    const map = new Map<string, EmployeeAttendanceRecord>();
    records.forEach((r) => {
      map.set(r.date, r);
    });
    return map;
  }, [records]);

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: Array<{ dayNumber: number | null; dateKey: string; isWeekend: boolean }> = [];

    // Blank cells before month start
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNumber: null, dateKey: `blank-${i}`, isWeekend: false });
    }

    // Days in current month
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

  return (
    <div className={`rounded-[8px] border border-[#E4E6E1] bg-white overflow-hidden shadow-none ${className}`}>
      {/* Header Toolbar */}
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

        {/* View Mode Toggle */}
        <div className="inline-flex rounded-[6px] bg-[#F0F1EE] p-0.5 text-[12px]">
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[5px] font-medium transition-colors ${
              viewMode === "calendar"
                ? "bg-white text-[#1F2933] border border-[#E4E6E1] font-semibold"
                : "text-[#52606D] hover:text-[#1F2933]"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[5px] font-medium transition-colors ${
              viewMode === "list"
                ? "bg-white text-[#1F2933] border border-[#E4E6E1] font-semibold"
                : "text-[#52606D] hover:text-[#1F2933]"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            List
          </button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        /* Calendar Grid */
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
                return <div key={item.dateKey || index} className="min-h-[72px] bg-[#F6F7F5]/40 rounded-[6px] border border-transparent" />;
              }

              const rec = recordMap.get(item.dateKey);
              const isToday = new Date().toISOString().slice(0, 10) === item.dateKey;

              const statusVariant =
                !rec
                  ? item.isWeekend
                    ? "off"
                    : "bad"
                  : rec.status === "present"
                  ? "ok"
                  : rec.status === "late" || rec.status === "half_day"
                  ? "warn"
                  : rec.status === "on_leave"
                  ? "leave"
                  : rec.status === "absent" || rec.status === "missing_punch"
                  ? "bad"
                  : "off";

              return (
                <div
                  key={item.dateKey}
                  onClick={() => rec && onSelectDay(rec)}
                  className={`min-h-[76px] p-2 rounded-[6px] border transition-all flex flex-col justify-between ${
                    rec ? "cursor-pointer hover:border-[#2F5FD0]" : ""
                  } ${
                    isToday
                      ? "border-[#2F5FD0] bg-[#E8EEFB]/30"
                      : item.isWeekend
                      ? "bg-[#F6F7F5] border-[#E4E6E1]"
                      : "bg-white border-[#E4E6E1]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[12px] font-medium ${
                        isToday
                          ? "bg-[#2F5FD0] text-white rounded-full w-5 h-5 flex items-center justify-center font-bold"
                          : item.isWeekend
                          ? "text-[#7B8794]"
                          : "text-[#1F2933]"
                      }`}
                    >
                      {item.dayNumber}
                    </span>
                    {rec && (
                      <span className="text-xs text-[#7B8794] font-mono">
                        {rec.total_hours != null && rec.total_hours > 0 ? `${rec.total_hours.toFixed(1)}h` : ""}
                      </span>
                    )}
                  </div>

                  <div className="mt-1">
                    {rec ? (
                      <StatusPill variant={statusVariant} dot>
                        {rec.status === "half_day"
                          ? "Half Day"
                          : rec.status === "missing_punch"
                          ? "Missed"
                          : rec.status === "on_leave"
                          ? "Leave"
                          : rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}
                      </StatusPill>
                    ) : item.isWeekend ? (
                      <span className="text-xs text-[#7B8794] font-medium">Off</span>
                    ) : (
                      <span className="text-xs text-[#A12D22] font-medium">No Punch</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-[#F6F7F5] border-b border-[#E4E6E1] text-[#7B8794] font-semibold text-[12px] normal-case tracking-normal h-[40px]">
              <tr className="h-[40px]">
                <th className="px-4 py-0 bg-[#F6F7F5]">Date</th>
                <th className="px-4 py-0 bg-[#F6F7F5]">Shift</th>
                <th className="px-4 py-0 bg-[#F6F7F5]">In Time</th>
                <th className="px-4 py-0 bg-[#F6F7F5]">Out Time</th>
                <th className="px-4 py-0 bg-[#F6F7F5]">Hours</th>
                <th className="px-4 py-0 bg-[#F6F7F5]">Status</th>
                <th className="px-4 py-0 bg-[#F6F7F5] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E6E1] bg-white text-[#1F2933]">
              {records.map((r) => {
                const statusVariant =
                  r.status === "present"
                    ? "ok"
                    : r.status === "late" || r.status === "half_day"
                    ? "warn"
                    : r.status === "on_leave"
                    ? "leave"
                    : r.status === "absent" || r.status === "missing_punch"
                    ? "bad"
                    : "off";

                return (
                  <tr
                    key={r.id}
                    onClick={() => onSelectDay(r)}
                    className="h-[48px] hover:bg-[#FAFAF8] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-0 align-middle font-medium text-[#1F2933]">{r.date}</td>
                    <td className="px-4 py-0 align-middle text-[#52606D] capitalize">{r.shift || "General Shift"}</td>
                    <td className="px-4 py-0 align-middle text-[#1F2933] font-mono">{r.status === "absent" ? "-" : (r.in_time || r.check_in || "-")}</td>
                    <td className="px-4 py-0 align-middle text-[#1F2933] font-mono">{r.status === "absent" ? "-" : (r.out_time || r.check_out || "-")}</td>
                    <td className="px-4 py-0 align-middle font-mono font-medium text-[#1F2933]">
                      {r.status === "absent" ? "-" : (r.total_hours != null ? `${r.total_hours.toFixed(1)}h` : "-")}
                    </td>
                    <td className="px-4 py-0 align-middle">
                      <StatusPill variant={statusVariant}>{r.status}</StatusPill>
                    </td>
                    <td className="px-4 py-0 align-middle text-right">
                      {(r.status === "missing_punch" || r.status === "late") && onRequestRegularization && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestRegularization(r);
                          }}
                          className="text-[13px] text-[#2F5FD0] hover:text-[#264FB0] font-medium cursor-pointer"
                        >
                          Regularize
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
