import React, { useState } from "react";
import { Plus, CalendarDays, History, LayoutDashboard } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { PageHeading } from "../../../components/ui/PageHeading";
import { Tabs } from "../../../components/ui/Tabs";
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
    <div className="flex w-full flex-col gap-5 pb-10">
      {/* Slim Page Header */}
      <PageHeading
        title="View remaining balances, submit time-off requests, and monitor upcoming team schedules."
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenApply()}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Apply Leave
          </Button>
        }
      />

      {/* Underline Navigation Tabs */}
      <div className="rounded-[2px] border border-[#E5E7EB] bg-white px-5 pt-2">
        <Tabs
          variant="underline"
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as "dashboard" | "history" | "calendar")}
          tabs={[
            {
              id: "dashboard",
              label: "Overview & Balances",
              icon: <LayoutDashboard className="h-4 w-4" />,
            },
            {
              id: "history",
              label: "My History & Entitlements",
              icon: <History className="h-4 w-4" />,
              badge: pendingCount > 0 ? pendingCount : undefined,
            },
            {
              id: "calendar",
              label: "Team Calendar",
              icon: <CalendarDays className="h-4 w-4" />,
            },
          ]}
        />
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
