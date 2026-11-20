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
    <div className={`rounded-lg border border-slate-200 bg-white overflow-hidden ${className}`}>
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-900">{monthLabel}</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded font-medium transition-colors ${
              viewMode === "calendar"
                ? "bg-slate-100 text-slate-900 font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded font-medium transition-colors ${
              viewMode === "list"
                ? "bg-slate-100 text-slate-900 font-semibold"
                : "text-slate-600 hover:text-slate-900"
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
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
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
                return <div key={item.dateKey || index} className="min-h-[72px] bg-slate-50/40 rounded border border-transparent" />;
              }

              const rec = recordMap.get(item.dateKey);
              const isToday = new Date().toISOString().slice(0, 10) === item.dateKey;

              const statusVariant =
                !rec
                  ? item.isWeekend
                    ? "neutral"
                    : "danger"
                  : rec.status === "present"
                  ? "success"
                  : rec.status === "late" || rec.status === "half_day"
                  ? "warning"
                  : rec.status === "on_leave"
                  ? "info"
                  : rec.status === "absent" || rec.status === "missing_punch"
                  ? "danger"
                  : "neutral";

              return (
                <div
                  key={item.dateKey}
                  onClick={() => rec && onSelectDay(rec)}
                  className={`min-h-[76px] p-2 rounded border transition-all flex flex-col justify-between ${
                    rec ? "cursor-pointer hover:border-blue-400 hover:shadow-xs" : ""
                  } ${
                    isToday
                      ? "border-blue-500 bg-blue-50/10"
                      : item.isWeekend
                      ? "bg-slate-50/70 border-slate-100"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-medium ${
                        isToday
                          ? "bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold"
                          : item.isWeekend
                          ? "text-slate-400"
                          : "text-slate-800"
                      }`}
                    >
                      {item.dayNumber}
                    </span>
                    {rec && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {rec.total_hours != null && rec.total_hours > 0 ? `${rec.total_hours.toFixed(1)}h` : ""}
                      </span>
                    )}
                  </div>

                  <div className="mt-1">
                    {rec ? (
                      <StatusPill variant={statusVariant} size="xs" dot>
                        {rec.status === "half_day"
                          ? "Half Day"
                          : rec.status === "missing_punch"
                          ? "Missed"
                          : rec.status === "on_leave"
                          ? "Leave"
                          : rec.status}
                      </StatusPill>
                    ) : item.isWeekend ? (
                      <span className="text-[10px] text-slate-400 font-medium">Off</span>
                    ) : (
                      <span className="text-[10px] text-rose-500 font-medium">No Punch</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="divide-y divide-slate-100 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Shift</th>
                <th className="px-4 py-2.5">In Time</th>
                <th className="px-4 py-2.5">Out Time</th>
                <th className="px-4 py-2.5">Hours</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r) => {
                const statusVariant =
                  r.status === "present"
                    ? "success"
                    : r.status === "late" || r.status === "half_day"
                    ? "warning"
                    : r.status === "on_leave"
                    ? "info"
                    : r.status === "absent" || r.status === "missing_punch"
                    ? "danger"
                    : "neutral";

                return (
                  <tr
                    key={r.id}
                    onClick={() => onSelectDay(r)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{r.date}</td>
                    <td className="px-4 py-3 text-slate-600">{r.shift || "General"}</td>
                    <td className="px-4 py-3 text-slate-700 font-mono">{r.in_time || r.check_in || "--"}</td>
                    <td className="px-4 py-3 text-slate-700 font-mono">{r.out_time || r.check_out || "--"}</td>
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">
                      {r.total_hours != null ? `${r.total_hours.toFixed(2)}h` : "--"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill variant={statusVariant}>{r.status}</StatusPill>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(r.status === "missing_punch" || r.status === "late") && onRequestRegularization && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestRegularization(r);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
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
