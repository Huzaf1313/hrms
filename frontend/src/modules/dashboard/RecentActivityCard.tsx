import type { CSSProperties } from "react";

import DashboardCard, { DashboardViewAllLink } from "./DashboardCard";
import type { RecentActivity } from "./dashboardService";
import { initialsFor } from "./dashboardData";

function relativeTime(createdAt: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(createdAt).getTime());
  const minutes = Math.floor(elapsed / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

interface RecentActivityCardProps {
  activities: RecentActivity[];
}

export default function RecentActivityCard({ activities }: RecentActivityCardProps) {
  return (
    <DashboardCard
      title="Recent Activities"
      className="col-span-12 md:col-span-6 xl:col-span-4"
      action={<DashboardViewAllLink />}
    >
      {activities.length === 0 ? (
        <p className="py-5 text-center text-xs text-gray-400">
          No recent activity yet.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {activities.map((activity, index) => (
          <li
            key={activity.id}
            className="dashboard-rise flex items-start gap-2.5"
            style={
              { "--dashboard-delay": `${index * 90}ms` } as CSSProperties
            }
          >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eff6ff] text-[9px] font-bold text-[#2563eb]">
              {initialsFor(activity.actor_name)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-snug text-gray-600">
                {activity.text}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-400">
                {relativeTime(activity.created_at)}
              </p>
            </div>
          </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
