import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function sameDate(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function DatePicker() {
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();
  const firstDay = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1,
  ).getDay();
  const calendarDays = Array.from(
    { length: firstDay + daysInMonth },
    (_, index) => (index < firstDay ? null : index - firstDay + 1),
  );

  function changeMonth(amount: number) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + amount, 1),
    );
  }

  function selectDate(day: number) {
    const nextDate = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      day,
    );
    setSelectedDate(nextDate);
    setIsOpen(false);
  }

  return (
    <div ref={pickerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="flex items-center gap-2 rounded-full border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
      >
        <CalendarDays className="h-4 w-4 text-gray-500" />
        <span className="hidden sm:inline">{formatDate(selectedDate)}</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Choose date"
          className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">
              {visibleMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-gray-400">
            {weekdayLabels.map((label) => (
              <span key={label} className="pb-2">{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <span key={`empty-${index}`} className="h-9" />;
              }

              const date = new Date(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth(),
                day,
              );
              const isSelected = sameDate(date, selectedDate);
              const isToday = sameDate(date, today);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                    isSelected
                      ? "bg-[#2563eb] font-semibold text-white"
                      : isToday
                        ? "font-semibold text-[#2563eb] hover:bg-blue-50"
                        : "text-gray-700 hover:bg-gray-100"
                  }`}
                  aria-label={date.toLocaleDateString("en-US", {
                    dateStyle: "full",
                  })}
                  aria-pressed={isSelected}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;
