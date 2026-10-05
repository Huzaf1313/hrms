import type { CSSProperties } from "react";
import { Video } from "lucide-react";

import DashboardCard, { DashboardViewAllLink } from "./DashboardCard";

import { initialsFor, interviewRows } from "./dashboardData";

export default function UpcomingInterviewsCard() {
  return (
    <DashboardCard
      title="Upcoming Interviews"
      className="col-span-12 md:col-span-6 xl:col-span-3"
      action={<DashboardViewAllLink />}
    >
      <div className="space-y-1.5">
        {interviewRows.map((row, index) => (
          <div
            key={row.id}
            className="dashboard-rise flex items-center gap-2.5 rounded-xl border border-gray-50 px-2 py-2 transition hover:border-[#dbeafe] hover:bg-[#eff6ff]"
            style={
              { "--dashboard-delay": `${index * 90}ms` } as CSSProperties
            }
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d1fae5] text-[10px] font-bold text-[#047857]">
              {initialsFor(row.candidateName)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-gray-700">
                {row.candidateName}
              </p>
              <p className="truncate text-[10px] text-gray-400">
                {row.position}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-[10px] font-medium text-gray-600">
                {row.dateLabel}
              </p>
              <p className="text-[10px] text-gray-400">{row.timeLabel}</p>
            </div>

            <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#eff6ff] px-2 py-0.5 text-[9px] font-semibold text-[#2563eb]">
              <Video className="h-2.5 w-2.5" />
              Scheduled
            </span>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}