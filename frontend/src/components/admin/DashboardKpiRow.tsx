import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Briefcase,
  ClipboardList,
  IndianRupee,
  Umbrella,
  UserCheck,
  Users,
} from "lucide-react";

import {
  dashboardPlaceholders,
  formatIndianAmount,
  payrollSummary,
} from "./dashboardData";
import type { DashboardMetrics } from "./useDashboardMetrics";
import { useAnimationFrame, useCountUp } from "./useDashboardAnimation";

interface DashboardKpiRowProps {
  /** Live figures where the API provides them; null keeps the placeholder. */
  metrics: DashboardMetrics;
  onOpenLeave: () => void;
  onOpenPayroll: () => void;
  /** Managers have no payroll or hiring permission, so those cards are hidden. */
  showHrWidgets?: boolean;
}

/** Cards that depend on a permission only HR holds. */
const HR_ONLY_CARD_IDS = new Set(["kpi-openings", "kpi-payroll"]);

interface KpiCard {
  id: string;
  label: string;
  value: number;
  icon: LucideIcon;
  iconClass: string;
  chipClass: string;
  renderValue: (value: number) => string;
  detail?: ReactNode;
  progress?: {
    percent: number;
    barClass: string;
  };
  delay: number;
}

function KpiValue({
  value,
  render,
}: {
  value: number;
  render: (value: number) => string;
}) {
  const animated = useCountUp(value);

  return <>{render(animated)}</>;
}

function AnimatedBar({
  percent,
  barClass,
  delay,
}: {
  percent: number;
  barClass: string;
  delay: number;
}) {
  const ready = useAnimationFrame();

  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full rounded-full transition-[width] duration-1000 ease-out ${barClass}`}
        style={{
          width: ready ? `${Math.min(Math.max(percent, 0), 100)}%` : "0%",
          transitionDelay: `${delay}ms`,
        }}
      />
    </div>
  );
}

export default function DashboardKpiRow({
  metrics,
  onOpenLeave,
  onOpenPayroll,
  showHrWidgets = true,
}: DashboardKpiRowProps) {
  const placeholders = dashboardPlaceholders;

  const headcount = metrics.totalEmployees ?? placeholders.totalEmployees;
  const presentToday = metrics.presentToday ?? placeholders.presentToday;
  const presentPercent = metrics.presentPercent ?? placeholders.presentPercent;
  const onLeaveToday = metrics.onLeaveToday ?? placeholders.onLeaveToday;
  const onLeavePercent = metrics.onLeavePercent ?? placeholders.onLeavePercent;
  const pendingLeave =
    metrics.pendingLeaveRequests ?? placeholders.pendingLeaveRequests;

  const cards: KpiCard[] = [
    {
      id: "kpi-employees",
      label: "Total Employees",
      value: headcount,
      icon: Users,
      iconClass: "text-[#2563eb]",
      chipClass: "bg-[#eff6ff]",
      renderValue: (value) => Math.round(value).toLocaleString("en-IN"),
      detail: (
        <span className="text-[11px] font-medium text-[#16a34a]">
          ↗ +{placeholders.employeesAddedThisMonth} this month
        </span>
      ),
      delay: 0,
    },
    {
      id: "kpi-present",
      label: "Present Today",
      value: presentToday,
      icon: UserCheck,
      iconClass: "text-[#16a34a]",
      chipClass: "bg-[#ecfdf5]",
      renderValue: (value) => Math.round(value).toLocaleString("en-IN"),
      detail: (
        <span className="text-[11px] font-medium text-[#16a34a]">
          {presentPercent}% of total
        </span>
      ),
      progress: {
        percent: presentPercent,
        barClass: "bg-[#22c55e]",
      },
      delay: 90,
    },
    {
      id: "kpi-leave",
      label: "On Leave",
      value: onLeaveToday,
      icon: Umbrella,
      iconClass: "text-[#7c3aed]",
      chipClass: "bg-[#f5f3ff]",
      renderValue: (value) => Math.round(value).toLocaleString("en-IN"),
      detail: (
        <span className="text-[11px] font-medium text-[#16a34a]">
          {onLeavePercent}% of total
        </span>
      ),
      progress: {
        // Leave is a small share, so scale it to a readable bar length.
        percent: onLeavePercent * 10,
        barClass: "bg-[#8b5cf6]",
      },
      delay: 180,
    },
    {
      id: "kpi-openings",
      label: "Open Positions",
      value: placeholders.openPositions,
      icon: Briefcase,
      iconClass: "text-[#ea580c]",
      chipClass: "bg-[#fff7ed]",
      renderValue: (value) => String(Math.round(value)),
      detail: (
        <span className="text-[11px] font-medium text-[#16a34a]">
          Hiring in progress
        </span>
      ),
      delay: 270,
    },
    {
      id: "kpi-pending-leave",
      label: "Pending Leave Requests",
      value: pendingLeave,
      icon: ClipboardList,
      iconClass: "text-[#dc2626]",
      chipClass: "bg-[#fef2f2]",
      renderValue: (value) => String(Math.round(value)),
      detail: (
        <button
          type="button"
          onClick={onOpenLeave}
          className="text-[11px] font-semibold text-[#2563eb] hover:underline"
        >
          View details →
        </button>
      ),
      delay: 360,
    },
    {
      id: "kpi-payroll",
      label: "Payroll This Month",
      value: payrollSummary.payrollThisMonth,
      icon: IndianRupee,
      iconClass: "text-[#ca8a04]",
      chipClass: "bg-[#fefce8]",
      renderValue: (value) => `₹ ${formatIndianAmount(Math.round(value))}`,
      detail: (
        <button
          type="button"
          onClick={onOpenPayroll}
          className="flex items-center gap-1 text-[11px] font-semibold text-[#2563eb] hover:underline"
        >
          View payroll <ArrowRight className="h-3 w-3" />
        </button>
      ),
      delay: 450,
    },
  ];

  const visibleCards = showHrWidgets
    ? cards
    : cards.filter((card) => !HR_ONLY_CARD_IDS.has(card.id));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {visibleCards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.id}
            className="dashboard-rise rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            style={
              { "--dashboard-delay": `${card.delay}ms` } as CSSProperties
            }
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.chipClass}`}
              >
                <Icon className={`h-5 w-5 ${card.iconClass}`} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-gray-900">
                  {card.label}
                </p>

                <p className="mt-1 text-xl font-extrabold tracking-tight text-black">
                  <KpiValue value={card.value} render={card.renderValue} />
                </p>

                {card.detail}

                {card.progress && (
                  <AnimatedBar
                    percent={card.progress.percent}
                    barClass={card.progress.barClass}
                    delay={card.delay}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}