import { Activity, ChevronRight } from "lucide-react";
import type { RecentActivity } from "./dashboardService";

interface RecentActivityCardProps {
  activities?: RecentActivity[];
  className?: string;
  onViewAll?: () => void;
}

export default function RecentActivityCard({
  activities = [],
  className = "col-span-12 md:col-span-6 xl:col-span-4",
  onViewAll,
}: RecentActivityCardProps) {
  // If activities from endpoint exist, display them; otherwise show the reference default feed
  const displayItems =
    activities.length > 0
      ? activities.map((item, index) => {
          const colors = [
            "border-[#0066ff] text-[#0066ff]",
            "border-[#16a34a] text-[#16a34a]",
            "border-[#ea580c] text-[#ea580c]",
          ];
          return {
            id: item.id,
            title: item.text.split(" - ")[0] || item.text,
            description: item.text.split(" - ")[1] || item.actor_name,
            time: "Recently",
            ringColor: colors[index % colors.length],
          };
        })
      : [
          {
            id: "1",
            title: "New employee added",
            description: "John Doe joined the organization",
            time: "2h ago",
            ringColor: "border-[#0066ff] text-[#0066ff]",
          },
          {
            id: "2",
            title: "Leave request approved",
            description: "by Manager",
            time: "3h ago",
            ringColor: "border-[#16a34a] text-[#16a34a]",
          },
          {
            id: "3",
            title: "Announcement posted",
            description: "Company policy update",
            time: "1d ago",
            ringColor: "border-[#ea580c] text-[#ea580c]",
          },
        ];

  return (
    <div
      className={`rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Activity className="h-4.5 w-4.5 text-[#0066ff]" />
          <h2 className="text-base font-bold text-[#0f172a] font-manrope">
            Recent Activities
          </h2>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0066ff] hover:underline"
        >
          View All
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Activity Timeline List */}
      <div className="space-y-4">
        {displayItems.slice(0, 3).map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              {/* Outer Ring Dot */}
              <div
                className={`mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 bg-white ${item.ringColor}`}
              >
                <div className="h-1.5 w-1.5 rounded-full bg-current" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 leading-tight">
                  {item.title}
                </p>
                <p className="text-[11px] text-slate-500 font-normal truncate mt-0.5">
                  {item.description}
                </p>
              </div>
            </div>

            <span className="shrink-0 text-[11px] font-medium text-slate-400">
              {item.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
