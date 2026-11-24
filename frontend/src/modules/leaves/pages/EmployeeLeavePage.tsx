import React, { useState } from "react";
import { Plus, CalendarDays, History, LayoutDashboard } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { currentSessionUser } from "../../../lib/session";
import { useLeaveBalances } from "../hooks/useLeaveBalances";
import { useLeaveRequests } from "../hooks/useLeaveRequests";
import { useTeamLeaves } from "../hooks/useTeamLeaves";
import { LeaveDashboard } from "./LeaveDashboard";
import { LeaveBalanceHistory } from "../components/LeaveBalanceHistory";
import { LeaveCalendarView } from "../components/LeaveCalendarView";
import { ApplyLeaveDrawer } from "../components/ApplyLeaveDrawer";

export const EmployeeLeavePage: React.FC = () => {
  const sessionUser = currentSessionUser();
  const employeeId = sessionUser?.employee_id || "EMP001";

  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "calendar">("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState<string | undefined>(undefined);

  const { balances, reload: reloadBalances } = useLeaveBalances(employeeId);
  const { allRequests, cancelRequest, reload: reloadRequests, pendingCount } = useLeaveRequests(employeeId);
  const { teamLeaves, holidays, reload: reloadTeam } = useTeamLeaves();

  const handleOpenApply = (type?: string) => {
    setSelectedLeaveType(type);
    setDrawerOpen(true);
  };

  const handleApplySuccess = () => {
    reloadBalances();
    reloadRequests();
    reloadTeam();
  };

  return (
    <div className="space-y-[16px]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[12px] bg-[#FFFFFF] p-[16px] rounded-[8px] border border-[#E4E6E1]">
        <div>
          <h1 className="text-[18px] font-semibold text-[#1F2933]">My Leaves</h1>
          <p className="text-[12px] text-[#4B5563] mt-[2px]">
            View remaining balances, submit time-off requests, and monitor upcoming team schedules.
          </p>
        </div>
        <div className="flex items-center gap-[10px]">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenApply()}
            className="flex items-center gap-[6px] shadow-none"
          >
            <Plus className="w-[14px] h-[14px]" />
            <span>Apply Leave</span>
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-[8px] border-b border-[#E4E6E1] pb-[8px]">
        <button
          type="button"
          onClick={() => setActiveTab("dashboard")}
          className={`flex items-center gap-[6px] px-[12px] py-[6px] rounded-[6px] text-[13px] font-medium transition-colors ${
            activeTab === "dashboard"
              ? "bg-[#2F5FD0] text-[#FFFFFF]"
              : "text-[#4B5563] hover:text-[#1F2933] hover:bg-[#F6F7F5]"
          }`}
        >
          <LayoutDashboard className="w-[14px] h-[14px]" />
          <span>Overview & Balances</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-[6px] px-[12px] py-[6px] rounded-[6px] text-[13px] font-medium transition-colors ${
            activeTab === "history"
              ? "bg-[#2F5FD0] text-[#FFFFFF]"
              : "text-[#4B5563] hover:text-[#1F2933] hover:bg-[#F6F7F5]"
          }`}
        >
          <History className="w-[14px] h-[14px]" />
          <span>My History & Entitlements</span>
          {pendingCount > 0 && (
            <span
              className={`ml-[4px] px-[6px] py-[1px] text-xs font-semibold rounded-full ${
                activeTab === "history"
                  ? "bg-[#FFFFFF] text-[#2F5FD0]"
                  : "bg-[#FFF4E5] text-[#8A5A00]"
              }`}
            >
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("calendar")}
          className={`flex items-center gap-[6px] px-[12px] py-[6px] rounded-[6px] text-[13px] font-medium transition-colors ${
            activeTab === "calendar"
              ? "bg-[#2F5FD0] text-[#FFFFFF]"
              : "text-[#4B5563] hover:text-[#1F2933] hover:bg-[#F6F7F5]"
          }`}
        >
          <CalendarDays className="w-[14px] h-[14px]" />
          <span>Team Calendar</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "dashboard" && (
        <LeaveDashboard
          balances={balances}
          requests={allRequests}
          holidays={holidays}
          onApplyClick={handleOpenApply}
        />
      )}

      {activeTab === "history" && (
        <LeaveBalanceHistory
          balances={balances}
          requests={allRequests}
          onCancelRequest={cancelRequest}
        />
      )}

      {activeTab === "calendar" && (
        <LeaveCalendarView
          teamLeaves={teamLeaves}
          holidays={holidays}
        />
      )}

      {/* Apply Leave Drawer */}
      <ApplyLeaveDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        balances={balances}
        existingRequests={allRequests}
        initialType={selectedLeaveType}
        onSuccess={handleApplySuccess}
      />
    </div>
  );
};

export default EmployeeLeavePage;
