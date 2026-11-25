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
      className={`flex h-full flex-col rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-none ${className}`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-[18px] w-[18px] text-[#2563EB]" />
          <h2 className="text-[14px] font-semibold text-[#111827]">
            Recent Activities
          </h2>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[#2563EB] hover:underline"
        >
          View All
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Activity Timeline List */}
      <div className="divide-y divide-[#F3F4F6]">
        {displayItems.slice(0, 3).map((item) => (
          <div key={item.id} className="flex min-h-[52px] items-center justify-between gap-3 py-2">
            <div className="flex items-start gap-3 min-w-0">
              {/* Outer Ring Dot */}
              <div
                className={`mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 bg-white ${item.ringColor}`}
              >
                <div className="h-1.5 w-1.5 rounded-full bg-current" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold leading-tight text-[#111827]">
                  {item.title}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-normal text-[#6B7280]">
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
