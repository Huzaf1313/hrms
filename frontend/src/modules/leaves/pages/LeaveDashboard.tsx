import React, { useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { StatStrip } from "../../../components/ui/StatStrip";
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
  const stats = useMemo(() => {
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
        subtext: "Annual allocation for 2026",
      },
      {
        label: "Available Balance",
        value: `${totalAvailable} Days`,
        subtext: "Ready to use",
      },
      {
        label: "Leaves Taken",
        value: `${totalUsed} Days`,
        subtext: "YTD approved absences",
      },
      {
        label: "Pending Approvals",
        value: pendingCount,
        subtext: pendingCount === 1 ? "1 request awaiting review" : `${pendingCount} requests in review`,
      },
    ];
  }, [balances, requests]);

  return (
    <div className={`space-y-[16px] ${className}`}>
      {/* KPI Stats */}
      <StatStrip items={stats} />

      {/* Leave Balances Header + Cards */}
      <div className="space-y-[12px]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold text-[#1F2933]">Leave Balances</h2>
            <p className="text-[12px] text-[#4B5563]">
              Allocated quotas and available balances for the calendar year 2026.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onApplyClick()}
            className="flex items-center gap-[6px]"
          >
            <Plus className="w-[14px] h-[14px]" />
            <span>Apply Leave</span>
          </Button>
        </div>

        <LeaveBalanceCards balances={balances} onApply={onApplyClick} />
      </div>

      {/* Bottom Grid: Upcoming Leaves & Holidays */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
        <UpcomingLeavesCard requests={requests} onApplyClick={() => onApplyClick()} />
        <UpcomingHolidaysCard holidays={holidays} />
      </div>
    </div>
  );
};

export default LeaveDashboard;
