import { useState } from "react";
import { Gift, PartyPopper } from "lucide-react";

import DashboardCard, { DashboardViewAllLink } from "./DashboardCard";

import {
  anniversaryRows,
  birthdayRows,
  initialsFor,
} from "./dashboardData";

type CelebrationTab = "birthday" | "anniversary";

export default function BirthdaysAndAnniversariesCard() {
  const [tab, setTab] = useState<CelebrationTab>("birthday");

  const rows = tab === "birthday" ? birthdayRows : anniversaryRows;

  const tabClass = (value: CelebrationTab) =>
    `-mb-px flex items-center gap-1 border-b-2 px-2 pb-2 text-[11px] font-semibold transition ${
      tab === value
        ? "border-[#2563eb] text-[#2563eb]"
        : "border-transparent text-gray-400 hover:text-gray-600"
    }`;

  return (
    <DashboardCard
      title="Upcoming Birthdays & Work Anniversaries"
      className="col-span-12 md:col-span-6 xl:col-span-4"
      action={<DashboardViewAllLink />}
    >
      <div className="mb-3 flex gap-1 border-b border-gray-100">
        <button
          type="button"
          onClick={() => setTab("birthday")}
          className={tabClass("birthday")}
        >
          <PartyPopper className="h-3 w-3" />
          Birthdays ({birthdayRows.length})
        </button>

        <button
          type="button"
          onClick={() => setTab("anniversary")}
          className={tabClass("anniversary")}
        >
          <Gift className="h-3 w-3" />
          Work Anniversaries ({anniversaryRows.length})
        </button>
      </div>

      <div className="space-y-1.5">
        {rows.map((row, index) => (
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

            <span className="shrink-0 text-[10px] font-medium text-gray-600">
              {row.dateLabel}
            </span>

            {row.kind === "birthday" ? (
              <PartyPopper className="h-3.5 w-3.5 shrink-0 text-rose-400" />
            ) : (
              <Gift className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            )}
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}