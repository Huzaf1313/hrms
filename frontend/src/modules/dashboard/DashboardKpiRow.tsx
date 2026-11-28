import {
  CalendarCheck,
  Clock,
  Umbrella,
  Users,
  UserX,
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
  const lateToday = metrics.lateToday ?? 0;
  const absentToday = metrics.absentToday ?? 0;

  const cards = [
    {
      id: "total-employees",
      label: "Total Employees",
      value: headcount,
      icon: Users,
      helper: "active employees",
      iconBg: "bg-[#F3F4F6]",
      iconColor: "text-[#4B5563]",
      onClick: onOpenEmployees || (() => { }),
    },
    {
      id: "present-today",
      label: "Present Today",
      value: presentToday,
      icon: CalendarCheck,
      helper: `${metrics.presentPercent ?? 0}% on time`,
      iconBg: "bg-[#ECFDF5]",
      iconColor: "text-[#047857]",
      onClick: onOpenAttendance || (() => { }),
    },
    {
      icon: Clock,
      id: "late",
      label: "Late",
      value: lateToday,
      helper: `${metrics.latePercent ?? 0}% late arrivals`,
      iconBg: "bg-[#FFFBEB]",
      iconColor: "text-[#B45309]",
      onClick: onOpenAttendance || (() => { }),
    },
    {
      id: "on-leave",
      label: "On Leave",
      value: onLeaveToday,
      helper: "approved leaves",
      icon: Umbrella,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#2563EB]",
      onClick: onOpenLeave,
    },
    {
      id: "absent",
      label: "Absent",
      value: absentToday,
      helper: `${metrics.absentPercent ?? 0}% unexcused`,
      icon: UserX,
      iconBg: "bg-[#FEF2F2]",
      iconColor: "text-[#B91C1C]",
      onClick: onOpenAttendance || (() => { }),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <button
            key={card.id}
            type="button"
            onClick={card.onClick}
            className="group relative flex w-full cursor-pointer flex-col justify-between rounded-[2px] border-2 border-[#E5E7EB] bg-white p-5 text-left shadow-kpi shadow-kpi-hover transition-all duration-200 hover:border-[#D1D5DB]"
          >
            <div className="flex w-full items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-[#6B7280]">{card.label}</p>
                <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-[#111827] tabular-nums">
                  {card.value}
                </p>
              </div>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg} ${card.iconColor}`}>
                <Icon className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-[12px] text-[#6B7280]">{card.helper}</p>
          </button>
        );
      })}
    </div>
  );
}
