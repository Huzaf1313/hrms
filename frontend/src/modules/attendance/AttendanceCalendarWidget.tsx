import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface AttendanceCalendarWidgetProps {
  selectedDate?: string;
  onSelectDate?: (dateStr: string) => void;
  className?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AttendanceCalendarWidget({
  selectedDate = "2026-11-19",
  onSelectDate,
  className = "",
}: AttendanceCalendarWidgetProps) {
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(10); // 10 is November (0-indexed)

  const monthName = new Date(currentYear, currentMonth, 1).toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric" },
  );

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  // Highlight dots on specific reference days
  const statusDots: Record<number, string> = {
    16: "bg-emerald-500", // Present
    17: "bg-purple-500", // On Leave
    18: "bg-amber-500", // Absent
  };

  const selectedDay = (() => {
    try {
      const parts = selectedDate.split("-");
      if (
        Number(parts[0]) === currentYear &&
        Number(parts[1]) === currentMonth + 1
      ) {
        return Number(parts[2]);
      }
    } catch {
      // fallback
    }
    return 19;
  })();

  function handlePrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function handleDayClick(day: number) {
    const formattedMonth = String(currentMonth + 1).padStart(2, "0");
    const formattedDay = String(day).padStart(2, "0");
    const dateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;
    onSelectDate?.(dateStr);
  }

  return (
    <div
      className={`rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Calendar className="h-4.5 w-4.5 text-[#0066ff]" />
        <h3 className="text-sm font-bold text-[#0f172a] font-manrope">
          Attendance Calendar
        </h3>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="text-xs font-bold text-[#0f172a] font-manrope">
          {monthName}
        </span>

        <button
          type="button"
          onClick={handleNextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday Names */}
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {WEEKDAYS.map((day) => (
          <span
            key={day}
            className="text-xs font-semibold text-slate-400"
          >
            {day}
          </span>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center">
        {/* Blank days before start */}
        {Array.from({ length: firstDayIndex }).map((_, idx) => (
          <div key={`blank-${idx}`} className="h-8 w-8" />
        ))}

        {/* Days of month */}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const day = idx + 1;
          const isSelected = day === selectedDay;
          const dotColor = statusDots[day];

          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDayClick(day)}
              className="relative flex flex-col items-center justify-center h-8 w-8 mx-auto rounded-full transition group"
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  isSelected
                    ? "bg-[#0066ff] text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {day}
              </span>

              {/* Status indicator dot */}
              {dotColor && !isSelected && (
                <span
                  className={`absolute -bottom-0.5 h-1 w-1 rounded-full ${dotColor}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-4 text-xs font-medium text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Present
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Absent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-purple-500" />
          On Leave
        </span>
      </div>
    </div>
  );
}
