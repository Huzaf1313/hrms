import React, { useMemo } from "react";
import { CalendarCheck2, CalendarDays, CheckCircle2, Clock } from "lucide-react";
import { LeaveBalanceCards } from "../components/LeaveBalanceCards";
import { UpcomingLeavesCard } from "../components/UpcomingLeavesCard";
import { UpcomingHolidaysCard } from "../components/UpcomingHolidaysCard";
import type { EmployeeLeaveBalance, LeaveRequest } from "../services/leaveService";
import type { MockHoliday } from "../../../services/mock/leaveMockService";

export interface LeaveDashboardProps {
  balances: EmployeeLeaveBalance[];
  requests: LeaveRequest[];
  holidays: MockHoliday[];
  onApplyClick: (type?: string) => void;
  className?: string;
}

export const LeaveDashboard: React.FC<LeaveDashboardProps> = ({
  balances,
  requests,
  holidays,
  onApplyClick,
  className = "",
}) => {
  const year = new Date().getFullYear();

  const kpiCards = useMemo(() => {
    const totalAllocated = balances.reduce((acc, b) => acc + (b.allocated || 0), 0);
    const totalUsed = balances.reduce((acc, b) => acc + (b.used || 0), 0);
    const totalAvailable = balances.reduce((acc, b) => acc + (b.available || 0), 0);
    const pendingCount = requests.filter(
      (r) => r.status && r.status.toLowerCase() === "pending"
    ).length;

    return [
      {
        label: "Total Entitled",
        value: `${totalAllocated} Days`,
        helper: `Annual allocation for ${year}`,
        icon: CalendarDays,
        tone: "bg-blue-50 text-[#2563EB]",
      },
      {
        label: "Available Balance",
        value: `${totalAvailable} Days`,
        helper: "Ready to use",
        icon: CheckCircle2,
        tone: "bg-emerald-50 text-emerald-600",
      },
      {
        label: "Leaves Taken",
        value: `${totalUsed} Days`,
        helper: "YTD approved absences",
        icon: CalendarCheck2,
        tone: "bg-purple-50 text-purple-600",
      },
      {
        label: "Pending Approvals",
        value: pendingCount,
        helper: pendingCount === 1 ? "1 request awaiting review" : `${pendingCount} requests in review`,
        icon: Clock,
        tone: "bg-amber-50 text-amber-600",
      },
    ];
  }, [balances, requests, year]);

  return (
    <div className={`space-y-5 ${className}`}>
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex min-h-[124px] flex-col rounded-[2px] border-2 border-[#E5E7EB] bg-white p-5 shadow-kpi"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-medium text-[#6B7280]">{card.label}</p>
                  <p className="mt-2 text-[26px] font-semibold leading-none text-[#111827]">
                    {card.value}
                  </p>
                </div>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-auto pt-3 text-[12px] text-[#6B7280]">{card.helper}</p>
            </div>
          );
        })}
      </div>

      {/* Leave Balances Section */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-[#111827]">Leave Balances</h2>
            <p className="text-[12px] text-[#6B7280]">
              Allocated quotas for {year}. Click any card to apply for that leave type.
            </p>
          </div>
        </div>

        <LeaveBalanceCards balances={balances} onApply={onApplyClick} />
      </div>

      {/* Bottom Grid: Upcoming Leaves & Holidays */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
        <UpcomingLeavesCard requests={requests} />
        <UpcomingHolidaysCard holidays={holidays} />
      </div>
    </div>
  );
};

export default LeaveDashboard;
