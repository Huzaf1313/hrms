import {
  ArrowRight,
  CalendarCheck,
  Clock,
  Umbrella,
  Users,
} from "lucide-react";
import type { DashboardMetrics } from "./useDashboardMetrics";

interface DashboardKpiRowProps {
  metrics: DashboardMetrics;
  onOpenLeave: () => void;
  onOpenPayroll: () => void;
  onOpenEmployees?: () => void;
  onOpenAttendance?: () => void;
  showHrWidgets?: boolean;
}

export default function DashboardKpiRow({
  metrics,
  onOpenLeave,
  onOpenEmployees,
  onOpenAttendance,
}: DashboardKpiRowProps) {
  const headcount = metrics.totalEmployees ?? 0;
  const presentToday = metrics.presentToday ?? 0;
  const onLeaveToday = metrics.onLeaveToday ?? 0;
  const pendingLeave = metrics.pendingLeaveRequests ?? 0;

  const cards = [
    {
      id: "total-employees",
      label: "Total Employees",
      value: headcount,
      icon: Users,
      iconBg: "bg-[#e8f1ff]",
      iconColor: "text-[#0066ff]",
      arrowBg: "bg-blue-50/70 hover:bg-blue-100 text-[#0066ff]",
      onClick: onOpenEmployees || (() => {}),
    },
    {
      id: "present-today",
      label: "Present Today",
      value: presentToday,
      icon: CalendarCheck,
      iconBg: "bg-[#e2f7ec]",
      iconColor: "text-[#16a34a]",
      arrowBg: "bg-emerald-50/70 hover:bg-emerald-100 text-[#16a34a]",
      onClick: onOpenAttendance || (() => {}),
    },
    {
      id: "on-leave",
      label: "On Leave",
      value: onLeaveToday,
      icon: Umbrella,
      iconBg: "bg-[#fff2e2]",
      iconColor: "text-[#ea580c]",
      arrowBg: "bg-orange-50/70 hover:bg-orange-100 text-[#ea580c]",
      onClick: onOpenLeave,
    },
    {
      id: "pending-leave-requests",
      label: "Pending Leave Requests",
      value: pendingLeave,
      icon: Clock,
      iconBg: "bg-[#f2edfe]",
      iconColor: "text-[#7c3aed]",
      arrowBg: "bg-purple-50/70 hover:bg-purple-100 text-[#7c3aed]",
      onClick: onOpenLeave,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.id}
            className="group relative rounded-3xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${card.iconBg} ${card.iconColor}`}
              >
                <Icon className="h-6 w-6" />
              </div>

              <div>
                <p className="text-3xl font-extrabold tracking-tight text-[#0f172a] font-manrope">
                  {card.value}
                </p>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  {card.label}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={card.onClick}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-150 group-hover:scale-105 ${card.arrowBg}`}
              title={`View ${card.label}`}
              aria-label={`View ${card.label}`}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
