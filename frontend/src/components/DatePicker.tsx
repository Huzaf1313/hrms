import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import AddHolidayModal from "./AddHolidayModal";
import { holidayService } from "../services/holidayService";
import {
  HOLIDAY_DOT_STYLE,
  HOLIDAY_TYPE_LABELS,
  formatHolidayDate,
  type Holiday,
} from "../types/holiday";

const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface DatePickerProps {
  /** Admins get the add/edit controls. Employees see the dots only. */
  canManageHolidays?: boolean;
}

/** "YYYY-MM-DD" for a local Date, so it matches the backend's date strings
 * without a timezone shifting the day. */
function toDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

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

function DatePicker({ canManageHolidays = false }: DatePickerProps) {
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const requestIdRef = useRef(0);

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

  // Only the visible month is fetched, so paging through the calendar stays
  // cheap no matter how many holidays are on record.
  const loadHolidays = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();

    try {
      const data = await holidayService.list({
        start_date: toDateKey(new Date(year, month, 1)),
        end_date: toDateKey(new Date(year, month + 1, 0)),
      });

      // Paging quickly can resolve an earlier request last; it must not
      // overwrite the month currently on screen.
      if (requestId !== requestIdRef.current) return;

      setHolidays(data);
    } catch {
      // A failed lookup must not break the calendar itself; the admin can
      // still pick a date and add the holiday from scratch.
      if (requestId !== requestIdRef.current) return;

      setHolidays([]);
    }
  }, [visibleMonth]);

  // Fetching the visible month's holidays is a genuine effect: it reads an
  // external system on mount and whenever the month changes. The setState calls
  // happen after the await, so this is not a synchronous cascade.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHolidays();
  }, [loadHolidays]);

  // Two holidays may share a date, so the map holds every one of them.
  const holidaysByDate = useMemo(() => {
    const map = new Map<string, Holiday[]>();

    holidays.forEach((holiday) => {
      const existing = map.get(holiday.date);

      if (existing) {
        existing.push(holiday);
      } else {
        map.set(holiday.date, [holiday]);
      }
    });

    return map;
  }, [holidays]);

  const monthHolidays = useMemo(
    () => [...holidays].sort((a, b) => a.date.localeCompare(b.date)),
    [holidays],
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

  function openAddHoliday() {
    setEditingHoliday(null);
    setIsHolidayModalOpen(true);
  }

  function openEditHoliday(holiday: Holiday) {
    setEditingHoliday(holiday);
    setIsHolidayModalOpen(true);
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

              const dayHolidays = holidaysByDate.get(toDateKey(date)) ?? [];

              // One dot per holiday, capped so a busy day cannot break the grid.
              const dots = dayHolidays.slice(0, 3);

              const tooltip = dayHolidays.length
                ? `${formatHolidayDate(toDateKey(date))} - ${dayHolidays
                    .map((holiday) => holiday.name)
                    .join(", ")}`
                : undefined;

              return (
                <div
                  key={day}
                  className="flex flex-col items-center"
                >
                  <button
                    type="button"
                    onClick={() => selectDate(day)}
                    title={tooltip}
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

                  <div className="mt-0.5 flex h-1 items-center gap-0.5">
                    {dots.map((holiday) => (
                      <span
                        key={holiday.id}
                        className={`h-1 w-1 rounded-full ${HOLIDAY_DOT_STYLE}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Holiday list. Doubles as the legend for employees. */}
          {monthHolidays.length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Holidays this month
              </p>

              <ul className="space-y-1">
                {monthHolidays.map((holiday) => {
                  const body = (
                    <>
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${HOLIDAY_DOT_STYLE}`}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-gray-800">
                          {holiday.name}
                        </span>
                        <span className="block text-[11px] text-gray-400">
                          {formatHolidayDate(holiday.date)}
                        </span>
                      </span>

                      <span className="shrink-0 text-[10px] text-gray-400">
                        {HOLIDAY_TYPE_LABELS[holiday.type]}
                      </span>
                    </>
                  );

                  return (
                    <li key={holiday.id}>
                      {canManageHolidays ? (
                        <button
                          type="button"
                          onClick={() => openEditHoliday(holiday)}
                          title={holiday.description ?? undefined}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-gray-50"
                        >
                          {body}
                        </button>
                      ) : (
                        <div
                          className="flex items-center gap-2 px-2 py-1.5"
                          title={holiday.description ?? undefined}
                        >
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {canManageHolidays && (
            <button
              type="button"
              onClick={openAddHoliday}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#2563eb] px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Holiday
            </button>
          )}
        </div>
      )}

      {/* Mounted only while open, and re-keyed per holiday/date, so the form always
          starts blank instead of being reset from inside an effect. */}
      {isHolidayModalOpen && (
        <AddHolidayModal
          key={`${editingHoliday?.id ?? "new"}-${toDateKey(selectedDate)}`}
          onClose={() => setIsHolidayModalOpen(false)}
          initialDate={toDateKey(selectedDate)}
          holiday={editingHoliday}
          onSaved={loadHolidays}
        />
      )}
    </div>
  );
}

export default DatePicker;