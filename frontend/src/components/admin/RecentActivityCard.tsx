import type { CSSProperties } from "react";

import DashboardCard, { DashboardViewAllLink } from "./DashboardCard";

import { activityRows, initialsFor } from "./dashboardData";

export default function RecentActivityCard() {
  return (
    <DashboardCard
      title="Recent Activities"
      className="col-span-12 md:col-span-6 xl:col-span-4"
      action={<DashboardViewAllLink />}
    >
      <ul className="space-y-2.5">
        {activityRows.map((row, index) => (
          <li
            key={row.id}
            className="dashboard-rise flex items-start gap-2.5"
            style={
              { "--dashboard-delay": `${index * 90}ms` } as CSSProperties
            }
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eff6ff] text-[9px] font-bold text-[#2563eb]">
              {initialsFor(row.text.split(" ").slice(1, 3).join(" ") || "HR")}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-snug text-gray-600">
                {row.text}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-400">
                {row.timeLabel}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}