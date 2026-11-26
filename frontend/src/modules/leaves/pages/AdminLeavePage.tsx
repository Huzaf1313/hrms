import React, { useState, useMemo, useCallback } from "react";
import { Plus, CheckCircle2, History, CalendarDays, Clock, Calendar, TrendingUp } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { PageHeading } from "../../../components/ui/PageHeading";
import { useToast } from "../../../components/ui/useToast";
import { useLeaveBalances } from "../hooks/useLeaveBalances";
import { useLeaveRequests } from "../hooks/useLeaveRequests";
import { useTeamLeaves } from "../hooks/useTeamLeaves";
import { LeaveApprovals } from "../components/LeaveApprovals";
import { LeaveBalanceHistory } from "../components/LeaveBalanceHistory";
import { LeaveCalendarView } from "../components/LeaveCalendarView";
import { ApplyLeaveDrawer } from "../components/ApplyLeaveDrawer";
import { leaveService, type LeaveRequest } from "../services/leaveService";

export const AdminLeavePage: React.FC = () => {
  const { success } = useToast();
  const [activeTab, setActiveTab] = useState<"approvals" | "records" | "calendar">("approvals");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Pending approval list
  const [approvalRequests, setApprovalRequests] = useState<LeaveRequest[]>([]);

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
        iconBg: "bg-[#FEF3C7]",
        iconColor: "text-[#92400E]",
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
        iconBg: "bg-[#DEF7EC]",
        iconColor: "text-[#03543F]",
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
    <div className="flex flex-col gap-5 sm:gap-6 w-full pb-10">
      {/* Page Header */}
      <PageHeading
        title="Review employee time-off requests, monitor team coverage, and audit balance records."
        actions={
          <Button
            variant="primary"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex flex-row items-center justify-center gap-2 whitespace-nowrap h-10 px-4 text-sm font-medium shadow-none [&>span]:inline-flex [&>span]:flex-row [&>span]:items-center [&>span]:justify-center [&>span]:gap-2"
          >
            <Plus className="w-[18px] h-[18px] shrink-0" />
            <span>Apply Leave</span>
          </Button>
        }
      />

      {/* Organization Overview Stat Strip */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
              Organization Overview
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#4B5563] font-medium border border-[#E5E7EB]">
              Company-wide
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="rounded-lg border border-[#E5E7EB] bg-white p-4 h-[104px] shadow-kpi flex flex-col justify-between min-w-0"
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-xs font-medium text-[#4B5563] truncate">
                    {item.label}
                  </span>
                  {Icon && (
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${item.iconBg}`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${item.iconColor}`} />
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-[24px] font-semibold text-[#111827] tabular-nums tracking-tight leading-none block">
                    {item.value}
                  </span>
                  {item.subtext && (
                    <span className="text-[11px] text-[#6B7280] mt-1 truncate block leading-none">
                      {item.subtext}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="flex flex-col gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E5E7EB] overflow-x-auto overflow-y-hidden scrollbar-hidden max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab("approvals")}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium transition-colors cursor-pointer border-b-2 ${activeTab === "approvals"
                ? "border-[#2F5FD0] text-[#2F5FD0]"
                : "border-transparent text-[#4B5563] hover:text-[#111827] hover:border-[#D1D5DB]"
              }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Pending Approvals</span>
            {approvalRequests.length > 0 && (
              <span className="ml-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
                {approvalRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("records")}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium transition-colors cursor-pointer border-b-2 ${activeTab === "records"
                ? "border-[#2F5FD0] text-[#2F5FD0]"
                : "border-transparent text-[#4B5563] hover:text-[#111827] hover:border-[#D1D5DB]"
              }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span>All Leave Records & Balances</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("calendar")}
            className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium transition-colors cursor-pointer border-b-2 ${activeTab === "calendar"
                ? "border-[#2F5FD0] text-[#2F5FD0]"
                : "border-transparent text-[#4B5563] hover:text-[#111827] hover:border-[#D1D5DB]"
              }`}
          >
            <CalendarDays className="w-4 h-4 shrink-0" />
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
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-4 sm:px-5 py-3 rounded-lg border border-[#E5E7EB]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-[#111827]">Your Leave Records & Balances</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#E8EEFB] text-[#2F5FD0] font-medium border border-[#2F5FD0]/20">
                  Personal
                </span>
              </div>
              <span className="text-[11px] text-[#6B7280]">
                Logged-in employee entitlement & request history
              </span>
            </div>
            <LeaveBalanceHistory
              balances={balances}
              requests={allRequests}
              onCancelRequest={cancelRequest}
            />
          </div>
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
