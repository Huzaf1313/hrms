import { useEffect, useMemo, useState } from "react";
import { Gift, PartyPopper } from "lucide-react";

import DashboardCard, { DashboardViewAllLink } from "./DashboardCard";

import { employeeService } from "../employees/employeeService";
import type { Employee } from "../employees/types";

import { initialsFor } from "./dashboardData";

type CelebrationTab = "birthday" | "anniversary";

/** How far ahead the card looks, matching the "upcoming" wording. */
const WINDOW_DAYS = 30;
const MS_PER_DAY = 86_400_000;

interface UpcomingRow {
  id: string;
  name: string;
  role: string;
  dateLabel: string;
  relativeLabel: string;
  daysAway: number;
}

function startOfToday(): Date {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Reads the `YYYY-MM-DD` prefix the API returns, ignoring any time part. */
function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;

  return new Date(Number(year), Number(month) - 1, Number(day));
}

/**
 * Builds a real calendar date, or null when the day does not exist in that
 * year - 29 February never lands in a common year.
 */
function safeDate(year: number, month: number, day: number): Date | null {
  const candidate = new Date(year, month - 1, day);

  if (
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return candidate;
}

/** The 29th of February is celebrated on the 28th outside leap years. */
function occurrenceDate(
  month: number,
  day: number,
  year: number,
): Date | null {
  return safeDate(year, month, day) ?? safeDate(year, 2, 28);
}

/** Next time the month-day falls, today included. */
function nextOccurrence(month: number, day: number, today: Date): Date | null {
  const thisYear = occurrenceDate(month, day, today.getFullYear());

  if (thisYear && thisYear.getTime() >= today.getTime()) {
    return thisYear;
  }

  return occurrenceDate(month, day, today.getFullYear() + 1);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function formatDateLabel(value: Date): string {
  return value.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function formatRelativeLabel(daysAway: number): string {
  if (daysAway === 0) {
    return "Today";
  }

  if (daysAway === 1) {
    return "Tomorrow";
  }

  return `in ${daysAway} days`;
}

function displayName(employee: Employee): string {
  return `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() ||
    employee.employee_id;
}

function buildUpcoming(
  employees: Employee[],
  today: Date,
): Record<CelebrationTab, UpcomingRow[]> {
  const birthdays: UpcomingRow[] = [];
  const anniversaries: UpcomingRow[] = [];

  for (const employee of employees) {
    const name = displayName(employee);
    const role = employee.designation || "Employee";

    const birthDate = parseDateOnly(employee.date_of_birth);

    if (birthDate) {
      const next = nextOccurrence(
        birthDate.getMonth() + 1,
        birthDate.getDate(),
        today,
      );

      const daysAway = next ? daysBetween(today, next) : Number.NaN;

      if (Number.isFinite(daysAway) && daysAway <= WINDOW_DAYS) {
        birthdays.push({
          id: `${employee.id}-birthday`,
          name,
          role,
          dateLabel: formatDateLabel(next as Date),
          relativeLabel: formatRelativeLabel(daysAway),
          daysAway,
        });
      }
    }

    const joiningDate = parseDateOnly(employee.joining_date);

    if (joiningDate) {
      const next = nextOccurrence(
        joiningDate.getMonth() + 1,
        joiningDate.getDate(),
        today,
      );

      const daysAway = next ? daysBetween(today, next) : Number.NaN;

      const years = next ? next.getFullYear() - joiningDate.getFullYear() : 0;

      // Year 0 has no completed anniversary yet, so it is listed as the
      // joining day instead of being dropped - otherwise a young company
      // never sees anything on this tab.
      if (Number.isFinite(daysAway) && daysAway <= WINDOW_DAYS) {
        anniversaries.push({
          id: `${employee.id}-anniversary`,
          name,
          role,
          dateLabel: formatDateLabel(next as Date),
          relativeLabel:
            years === 0
              ? "Joined"
              : `${years} ${years === 1 ? "year" : "years"}`,
          daysAway,
        });
      }
    }
  }

  const bySoonest = (a: UpcomingRow, b: UpcomingRow) =>
    a.daysAway - b.daysAway || a.name.localeCompare(b.name);

  return {
    birthday: birthdays.sort(bySoonest),
    anniversary: anniversaries.sort(bySoonest),
  };
}

export default function BirthdaysAndAnniversariesCard() {
  const [tab, setTab] = useState<CelebrationTab>("birthday");
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    employeeService
      .listAll({ status: "active" })
      .then((list) => {
        if (!active) {
          return;
        }

        setEmployees(list);
        setError("");
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setEmployees([]);
        setError("Unable to load celebrations.");
      });

    return () => {
      active = false;
    };
  }, []);

  const upcoming = useMemo(
    () => buildUpcoming(employees ?? [], startOfToday()),
    [employees],
  );

  const rows = upcoming[tab];

  const tabClass = (value: CelebrationTab) =>
    `flex items-center gap-1 border-b-2 px-2 pb-2 text-[11px] font-bold transition ${
      tab === value
        ? "border-[#2563eb] text-[#2563eb]"
        : "border-transparent text-black hover:opacity-70"
    }`;

  return (
    <DashboardCard
      title="Upcoming Birthdays & Work Anniversaries"
      className="col-span-12 md:col-span-6 lg:col-span-3"
      action={<DashboardViewAllLink />}
    >
      <div className="mb-3 flex gap-1 border-b border-gray-100">
        <button
          type="button"
          onClick={() => setTab("birthday")}
          className={tabClass("birthday")}
        >
          <PartyPopper className="h-3 w-3" />
          Birthdays ({upcoming.birthday.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("anniversary")}
          className={tabClass("anniversary")}
        >
          <Gift className="h-3 w-3" />
          Work Anniversaries ({upcoming.anniversary.length})
        </button>
      </div>

      <div className="space-y-1.5">
        {employees === null && (
            <p className="py-4 text-center text-[11px] text-gray-400">
              Loading celebrations…
            </p>
        )}

        {employees !== null && rows.length === 0 && (
            <p className="flex items-center justify-center gap-2 py-4 text-center text-[11px] text-gray-400">
              <PartyPopper className="h-4 w-4 text-gray-300" />
              {error ||
                `No upcoming ${tab === "birthday" ? "birthdays" : "work anniversaries"} in the next ${WINDOW_DAYS} days.`}
            </p>
        )}

        {rows.slice(0, 5).map((row, index) => (
          <div
            key={row.id}
            className="dashboard-fade-in flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-gray-50"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ffe4e6] text-[10px] font-bold text-[#be123c]">
              {initialsFor(row.name)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-gray-700">
                {row.name}
              </p>
              <p className="truncate text-[10px] text-gray-400">{row.role}</p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-[10px] font-medium text-gray-600">
                {row.dateLabel}
              </p>
              <p className="text-[9px] text-gray-400">{row.relativeLabel}</p>
            </div>

            {tab === "birthday" ? (
              <PartyPopper className="h-3.5 w-3.5 shrink-0 text-rose-400" />
            ) : (
              <Gift className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            )}
          </div>
        ))}
      </div>

      {rows.length > 5 && (
        <p className="mt-3 text-[10px] text-gray-400">
          Showing 5 of {rows.length}.
        </p>
      )}
    </DashboardCard>
  );
}
