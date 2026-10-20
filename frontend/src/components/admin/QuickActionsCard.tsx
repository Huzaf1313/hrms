import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  CalendarCheck,
  Clock,
  Megaphone,
  UserPlus,
  Wallet,
} from "lucide-react";

import DashboardCard from "./DashboardCard";

import { quickActions } from "./dashboardData";
import { canAccessPage } from "../../lib/access";

const ICONS: Record<string, LucideIcon> = {
  "user-plus": UserPlus,
  briefcase: Briefcase,
  "calendar-check": CalendarCheck,
  clock: Clock,
  wallet: Wallet,
  megaphone: Megaphone,
};

/** Actions that already have a destination in the admin shell. */
function targetPageFor(action: (typeof quickActions)[number]): string | null {
  switch (action.icon) {
    case "user-plus":
      return "Employees";

    case "wallet":
      return "Payroll";

    case "clock":
      return "Attendance";

    default:
      return action.label.startsWith("Apply") ? "Leave" : null;
  }
}

interface QuickActionsCardProps {
  onNavigate?: (page: string) => void;
  /** Sends the admin to the announcement form instead of the list. */
  onCreateAnnouncement?: () => void;
  /** Managers cannot open payroll, so that quick action is dropped. */
  showHrWidgets?: boolean;
}

export default function QuickActionsCard({
  onNavigate,
  onCreateAnnouncement,
  showHrWidgets = true,
}: QuickActionsCardProps) {
  const actions = showHrWidgets
    ? quickActions
    : quickActions.filter(
        (action) =>
          !targetPageFor(action) || canAccessPage(targetPageFor(action)!),
      );

  return (
    <DashboardCard
      title="Quick Actions"
      className="col-span-12 md:col-span-6 xl:col-span-4"
    >
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {actions.map((action, index) => {
          const Icon = ICONS[action.icon] ?? Briefcase;
          const targetPage = targetPageFor(action);

          const handleClick =
            action.icon === "megaphone"
              ? onCreateAnnouncement
              : targetPage && onNavigate
                ? () => onNavigate(targetPage)
                : undefined;

          return (
            <button
              key={action.id}
              type="button"
              onClick={handleClick}
              className="dashboard-rise group flex flex-col items-center gap-2 rounded-xl border border-gray-100 px-2 py-3 text-center transition hover:border-[#bfdbfe] hover:shadow-sm"
              style={
                { "--dashboard-delay": `${index * 70}ms` } as CSSProperties
              }
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${action.chipClass} transition group-hover:scale-105`}
              >
                <Icon className={`h-4 w-4 ${action.iconClass}`} />
              </span>

              <span className="text-[10px] font-medium leading-tight text-gray-600">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </DashboardCard>
  );
}