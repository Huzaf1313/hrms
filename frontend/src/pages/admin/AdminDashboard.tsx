import { useMemo } from "react";
import { Hand } from "lucide-react";

import DashboardTicker from "../../components/DashboardTicker";
import { useEmployeeAnnouncements } from "../../hooks/useEmployeeData";
import type { Celebration } from "../../types/celebration";
import type { RecentActivity } from "../../services/dashboardService";

import AttendanceTrendChart from "../../components/admin/AttendanceTrendChart";
import BirthdaysAndAnniversariesCard from "../../components/admin/BirthdaysAndAnniversariesCard";
import DashboardKpiRow from "../../components/admin/DashboardKpiRow";
import DepartmentDonut from "../../components/admin/DepartmentDonut";
import PayrollExpenseSummaryCard from "../../components/admin/PayrollExpenseSummaryCard";
import PendingLeaveRequestsCard from "../../components/admin/PendingLeaveRequestsCard";
import QuickActionsCard from "../../components/admin/QuickActionsCard";
import RecentActivityCard from "../../components/admin/RecentActivityCard";
import RecruitmentFunnel from "../../components/admin/RecruitmentFunnel";
import UpcomingInterviewsCard from "../../components/admin/UpcomingInterviewsCard";
import { useDashboardMetrics } from "../../components/admin/useDashboardMetrics";
import { isHrAdmin } from "../../lib/access";

interface AdminDashboardProps {
  /** Live values the dashboard endpoint already provides. */
  totalHeadcount?: number | null;
  celebrations?: Celebration[];
  recentActivities?: RecentActivity[];
  onNavigate: (page: string) => void;
  /** Opens the announcement create form, used by the quick action. */
  onCreateAnnouncement?: () => void;
}

function readUserFirstName(): string {
  try {
    const raw = localStorage.getItem("user");

    const user = raw ? (JSON.parse(raw) as { full_name?: string }) : null;

    const fullName = user?.full_name?.trim();

    return fullName ? fullName.split(" ")[0] : "Admin";
  } catch {
    return "Admin";
  }
}

export default function AdminDashboard({
  totalHeadcount,
  celebrations = [],
  recentActivities = [],
  onNavigate,
  onCreateAnnouncement,
}: AdminDashboardProps) {
  const firstName = useMemo(() => readUserFirstName(), []);
  // If the feed fails to load the banner just shows celebrations (or the
  // daily thought); announcements have their own page with error handling.
  const { data: announcementFeed } = useEmployeeAnnouncements(1, 5);

  // Hiring, payroll and interview widgets are HR-only and the manager has no
  // permission behind them, so they are not rendered at all.
  const showHrWidgets = isHrAdmin();

  const { metrics, refresh } = useDashboardMetrics(totalHeadcount ?? null);

  return (
    <div className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {firstName}!{" "}
          <Hand aria-hidden="true" className="ml-1 inline h-5 w-5 align-middle" />
        </h1>

        <p className="mt-1 text-[13px] text-gray-500">
          Here's what's happening in your organization today.
        </p>
      </div>

      {/* One banner: birthdays, anniversaries and the announcements this
          account can see (same feed as the employee portal). Falls back to
          a daily thought when there is nothing to show. */}
      <div className="mb-4">
        <DashboardTicker
          celebrations={celebrations}
          announcements={announcementFeed?.announcements ?? []}
          onSelectAnnouncement={() => onNavigate("Announcement")}
        />
      </div>

      <div className="space-y-4">
        <DashboardKpiRow
          metrics={metrics}
          showHrWidgets={showHrWidgets}
          onOpenLeave={() => onNavigate("Leave")}
          onOpenPayroll={() => onNavigate("Payroll")}
        />

        <div className="grid grid-cols-12 gap-4">
          <AttendanceTrendChart />

          {showHrWidgets && (
            <>
              <RecruitmentFunnel
                metrics={metrics}
                onOpenRecruitment={() => onNavigate("Recruitment")}
              />
              <PayrollExpenseSummaryCard
                onOpenPayroll={() => onNavigate("Payroll")}
                payrollThisMonth={metrics.payrollThisMonth}
                totalExpenses={metrics.totalExpensesThisMonth}
                payrollChangePercent={metrics.payrollChangePercent}
                expenseChangePercent={metrics.expenseChangePercent}
                isLoading={metrics.isPayrollLoading}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-12 gap-4">
          <PendingLeaveRequestsCard
            onOpenLeave={() => onNavigate("Leave")}
            onChanged={refresh}
          />

          {showHrWidgets && (
            <UpcomingInterviewsCard
              metrics={metrics}
              onOpenRecruitment={() => onNavigate("Recruitment")}
            />
          )}

          <BirthdaysAndAnniversariesCard />
        </div>

        <div className="grid grid-cols-12 gap-4">
          <RecentActivityCard activities={recentActivities} />
          <QuickActionsCard
            onNavigate={onNavigate}
            onCreateAnnouncement={onCreateAnnouncement}
            showHrWidgets={showHrWidgets}
          />
          <DepartmentDonut counts={metrics.departmentCounts} />
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-gray-100 pt-4 text-[11px] text-gray-400 sm:flex-row">
        <p>© 2024 HRMS. All rights reserved.</p>

        <div className="flex items-center gap-3">
          <button type="button" className="hover:text-gray-600">
            Privacy Policy
          </button>

          <span aria-hidden="true">|</span>

          <button type="button" className="hover:text-gray-600">
            Terms &amp; Conditions
          </button>
        </div>
      </div>
    </div>
  );
}
