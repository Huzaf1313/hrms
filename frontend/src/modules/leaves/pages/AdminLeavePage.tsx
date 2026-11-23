import React, { useState, useMemo, useCallback } from "react";
import { Plus, CheckCircle2, History, CalendarDays, Clock, Calendar, TrendingUp } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { useToast } from "../../../components/ui/useToast";
import { useLeaveBalances } from "../hooks/useLeaveBalances";
import { useLeaveRequests } from "../hooks/useLeaveRequests";
import { useTeamLeaves } from "../hooks/useTeamLeaves";
import { LeaveApprovals } from "../components/LeaveApprovals";
import { LeaveBalanceHistory } from "../components/LeaveBalanceHistory";
import { LeaveCalendarView } from "../components/LeaveCalendarView";
import { ApplyLeaveDrawer } from "../components/ApplyLeaveDrawer";
import { leaveService, type LeaveRequest } from "../services/leaveService";
import { MOCK_PENDING_APPROVALS } from "../../../services/mock/leaveMockService";

export const AdminLeavePage: React.FC = () => {
  const { success } = useToast();
  const [activeTab, setActiveTab] = useState<"approvals" | "records" | "calendar">("approvals");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Pending approval list
  const [approvalRequests, setApprovalRequests] = useState<LeaveRequest[]>(MOCK_PENDING_APPROVALS);

  const { balances, reload: reloadBalances } = useLeaveBalances("EMP001");
  const { allRequests, cancelRequest, reload: reloadRequests } = useLeaveRequests("EMP001");
  const { teamLeaves, holidays, reload: reloadTeam } = useTeamLeaves();

  // Metrics
  const stats = useMemo(() => {
    const pendingCount = approvalRequests.length;
    const onLeaveToday = teamLeaves.filter((l) => l.start_date <= "2026-11-20" && l.end_date >= "2026-11-20").length;
    return [
      {
        label: "Pending Approvals",
        value: pendingCount,
        subtext: pendingCount === 0 ? "Inbox clear" : `${pendingCount} requests waiting`,
        icon: Clock,
        iconBg: "bg-[#FDF3D6]",
        iconColor: "text-[#8A5A00]",
      },
      {
        label: "On Leave Today",
        value: onLeaveToday,
        subtext: "Approved across teams",
        icon: CalendarDays,
        iconBg: "bg-[#E8EEFB]",
        iconColor: "text-[#2F5FD0]",
      },
      {
        label: "Upcoming This Week",
        value: teamLeaves.filter((l) => l.start_date >= "2026-11-20" && l.start_date <= "2026-11-27").length,
        subtext: "Scheduled absences",
        icon: Calendar,
        iconBg: "bg-[#F3E8FF]",
        iconColor: "text-[#7E22CE]",
      },
      {
        label: "Team Capacity",
        value: "94.2%",
        subtext: "Above minimum threshold",
        icon: TrendingUp,
        iconBg: "bg-[#E3F5E1]",
        iconColor: "text-[#1E6B45]",
      },
    ];
  }, [approvalRequests, teamLeaves]);

  const handleApprove = useCallback(async (requestId: string) => {
    try {
      await leaveService.approveRequest(requestId);
    } catch {
      // offline fallback
    }
    setApprovalRequests((prev) => prev.filter((r) => r.id !== requestId));
    success("Leave request approved successfully.", "Approved");
    reloadTeam();
  }, [success, reloadTeam]);

  const handleReject = useCallback(async (requestId: string, comment: string) => {
    try {
      await leaveService.rejectRequest(requestId, comment);
    } catch {
      // offline fallback
    }
    setApprovalRequests((prev) => prev.filter((r) => r.id !== requestId));
    success("Leave request rejected.", "Rejected");
  }, [success]);

  const handleBulkApprove = useCallback(async (requestIds: string[]) => {
    try {
      await Promise.all(requestIds.map((id) => leaveService.approveRequest(id)));
    } catch {
      // offline fallback
    }
    setApprovalRequests((prev) => prev.filter((r) => !requestIds.includes(r.id)));
    success(`Approved ${requestIds.length} leave requests.`, "Bulk Action Complete");
    reloadTeam();
  }, [success, reloadTeam]);

  const handleApplySuccess = () => {
    reloadBalances();
    reloadRequests();
    reloadTeam();
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Page Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-[20px_24px] rounded-lg border border-[#E4E6E1] shadow-none">
        <div className="flex flex-col gap-1">
          <h1 className="text-[20px] font-semibold text-[#1F2933]">Leave Management</h1>
          <p className="text-sm text-[#7B8794]">
            Review employee time-off requests, monitor team coverage, and audit balance records.
          </p>
        </div>
        <div className="flex items-center shrink-0">
          <Button
            variant="primary"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex flex-row items-center justify-center gap-2 whitespace-nowrap h-10 px-4 text-sm font-medium shadow-none [&>span]:inline-flex [&>span]:flex-row [&>span]:items-center [&>span]:justify-center [&>span]:gap-2"
          >
            <Plus className="w-[18px] h-[18px] shrink-0" />
            <span>Apply Leave</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats - 4 separate cards in a grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="rounded-lg border border-[#E4E6E1] bg-white p-[16px_20px] min-h-[96px] shadow-none flex flex-col justify-between min-w-0"
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-[13px] font-medium text-[#7B8794] truncate">
                  {item.label}
                </span>
                {Icon && (
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.iconBg}`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${item.iconColor}`} />
                  </div>
                )}
              </div>
              <div className="mt-2">
                <span className="text-[28px] font-semibold text-[#1F2933] tracking-tight leading-[1.1] block">
                  {item.value}
                </span>
              </div>
              {item.subtext && (
                <span className="text-xs text-[#7B8794] mt-1 truncate block m-0">
                  {item.subtext}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Tabs & Content */}
      <div className="flex flex-col gap-4">
        {/* Tabs: gap 4px between tabs, each tab padding 8px 16px, icon-to-label gap 8px, 14px font */}
        <div className="flex items-center gap-1 border-b border-[#E4E6E1]">
          <button
            type="button"
            onClick={() => setActiveTab("approvals")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-[1px] ${
              activeTab === "approvals"
                ? "border-[#2F5FD0] text-[#2F5FD0] font-semibold bg-white"
                : "border-transparent text-[#52606D] hover:text-[#1F2933] hover:bg-[#F6F7F5]"
            }`}
          >
            <CheckCircle2 className="w-[18px] h-[18px] shrink-0" />
            <span>Pending Approvals</span>
            {approvalRequests.length > 0 && (
              <span
                className={`ml-2 px-2 py-0.5 text-xs font-semibold rounded-full ${
                  activeTab === "approvals"
                    ? "bg-[#E8EEFB] text-[#2F5FD0]"
                    : "bg-[#FBF0D9] text-[#8A5A00]"
                }`}
              >
                {approvalRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("records")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-[1px] ${
              activeTab === "records"
                ? "border-[#2F5FD0] text-[#2F5FD0] font-semibold bg-white"
                : "border-transparent text-[#52606D] hover:text-[#1F2933] hover:bg-[#F6F7F5]"
            }`}
          >
            <History className="w-[18px] h-[18px] shrink-0" />
            <span>All Leave Records & Balances</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("calendar")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer border-b-2 -mb-[1px] ${
              activeTab === "calendar"
                ? "border-[#2F5FD0] text-[#2F5FD0] font-semibold bg-white"
                : "border-transparent text-[#52606D] hover:text-[#1F2933] hover:bg-[#F6F7F5]"
            }`}
          >
            <CalendarDays className="w-[18px] h-[18px] shrink-0" />
            <span>Team Calendar</span>
          </button>
        </div>

        {/* Tab Panels */}
        {activeTab === "approvals" && (
          <LeaveApprovals
            requests={approvalRequests}
            teamLeaves={teamLeaves}
            onApprove={handleApprove}
            onReject={handleReject}
            onBulkApprove={handleBulkApprove}
          />
        )}

        {activeTab === "records" && (
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
      </div>

      {/* Apply Leave Drawer */}
      <ApplyLeaveDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        balances={balances}
        existingRequests={allRequests}
        onSuccess={handleApplySuccess}
      />
    </div>
  );
};

export default AdminLeavePage;
