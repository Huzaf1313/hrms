import { useMemo } from "react";
import type { Celebration } from "./celebrationTypes";
import type { RecentActivity } from "./dashboardService";

import AttendanceTrendChart from "../attendance/AttendanceTrendChart";
import BirthdaysAndAnniversariesCard from "./BirthdaysAndAnniversariesCard";
import DashboardKpiRow from "./DashboardKpiRow";
import DepartmentDonut from "../departments/DepartmentDonut";
import PayrollExpenseSummaryCard from "../payroll/PayrollExpenseSummaryCard";
import PendingLeaveRequestsCard from "../leaves/PendingLeaveRequestsCard";
import PerformanceSummaryCard from "./PerformanceSummaryCard";
import RecentActivityCard from "./RecentActivityCard";
import RecruitmentFunnel from "../recruitment/RecruitmentFunnel";
import UpcomingInterviewsCard from "../recruitment/UpcomingInterviewsCard";
import { useDashboardMetrics } from "./useDashboardMetrics";
import { isHrAdmin } from "../../lib/access";
import { Button } from "../../components/ui/Button";
import { CalendarCheck, UserPlus } from "lucide-react";
import { RegularizationRequestsCard } from "../attendance/RegularizationRequestsCard";
import DashboardAlerts from "./DashboardAlerts";
import AnnouncementMarquee from "../announcements/AnnouncementMarquee";
import { useAdminAnnouncements } from "../../hooks/useEmployeeData";

interface AdminDashboardProps {
  /** Live values the dashboard endpoint already provides. */
  totalHeadcount?: number | null;
  celebrations?: Celebration[];
  recentActivities?: RecentActivity[];
  onNavigate: (page: string) => void;
  onCreateEmployee?: () => void;
  /** Opens the announcement create form, used by the quick action. */
  onCreateAnnouncement?: () => void;
}

function readUserFirstName(): string {
  try {
    const raw = localStorage.getItem("user");
    const user = raw ? (JSON.parse(raw) as { full_name?: string }) : null;
    const fullName = user?.full_name?.trim();
    return fullName ? fullName.split(" ")[0] : "Atharv";
  } catch {
    return "Atharv";
  }
}

export default function AdminDashboard({
  totalHeadcount,
  recentActivities = [],
  onNavigate,
  onCreateEmployee,
}: AdminDashboardProps) {
  const firstName = useMemo(() => readUserFirstName(), []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const displayDate = useMemo(
    () =>
      new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [],
  );

  const showHrWidgets = isHrAdmin();
  const { metrics, refresh } = useDashboardMetrics(totalHeadcount ?? null);
  const {
    data: dashboardAnnouncements = [],
    isLoading: loadingAnnouncements,
    isError: hasAnnouncementError,
  } = useAdminAnnouncements();

  return (
    <div className="space-y-5 pb-12">
      {/* Slim page header */}
      <div className="flex flex-col gap-4 border-b border-[#E5E7EB] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[20px] font-semibold leading-tight text-[#111827]">Dashboard</h1>
          <p className="mt-1 text-[12px] text-[#6B7280]">
            {greeting.toLowerCase()}, {firstName} · {displayDate}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateEmployee ?? (() => onNavigate("Employees"))}
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            Add Employee
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate("Attendance")}
            leftIcon={<CalendarCheck className="h-4 w-4" />}
          >
            Mark Attendance
          </Button>
        </div>
      </div>

      <AnnouncementMarquee
        announcements={dashboardAnnouncements}
        loading={loadingAnnouncements}
        error={hasAnnouncementError ? "Unable to load announcements." : ""}
        onViewAll={() => onNavigate("Announcement")}
      />

      {/* 2. KPI Metrics */}
      <div className="pt-2">
        <DashboardKpiRow
          metrics={metrics}
          onOpenLeave={() => onNavigate("Leave")}
          onOpenPayroll={() => onNavigate("Payroll")}
          onOpenEmployees={() => onNavigate("Employees")}
          onOpenAttendance={() => onNavigate("Attendance")}
        />
      </div>

      <DashboardAlerts metrics={metrics} onNavigate={onNavigate} />

      {/* 3. Attendance and pending actions */}
      <div className="grid grid-cols-12 items-stretch gap-4">
        <AttendanceTrendChart
          className="col-span-12 lg:col-span-8"
          summary={{
            presentPercent: metrics.presentPercent,
            latePercent: metrics.latePercent,
            onLeavePercent: metrics.onLeavePercent,
            absentPercent: metrics.absentPercent,
          }}
        />
        <div className="col-span-12 flex flex-col gap-3 self-start lg:col-span-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-[13px] font-semibold text-[#111827]">Action Center</h2>
              <p className="text-[11px] text-[#6B7280]">Items needing your review</p>
            </div>
            <span className="rounded-full bg-[#FFFBEB] px-2 py-1 text-[10px] font-medium text-[#92400E]">
              Pending
            </span>
          </div>
          <PendingLeaveRequestsCard
            onOpenLeave={() => onNavigate("Leave")}
            onChanged={refresh}
          />
          <RegularizationRequestsCard onReviewed={refresh} />
        </div>
      </div>

      {/* 4. People and performance */}
      <div className="grid grid-cols-12 items-stretch gap-4">
        <DepartmentDonut
          counts={metrics.departmentCounts}
          className="col-span-12 lg:col-span-4"
          onViewAll={() => onNavigate("Employees")}
        />

        <RecentActivityCard
          activities={recentActivities}
          className="col-span-12 lg:col-span-4"
          onViewAll={() => onNavigate("Announcement")}
        />
        <PerformanceSummaryCard
          className="col-span-12 lg:col-span-4"
          onViewDetails={() => onNavigate("Employees")}
        />
      </div>

      {/* 5. Operations */}
      <div className="grid grid-cols-12 items-stretch gap-4">
          <BirthdaysAndAnniversariesCard />

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
              <UpcomingInterviewsCard
                metrics={metrics}
                onOpenRecruitment={() => onNavigate("Recruitment")}
              />
            </>
          )}
      </div>

      {/* 6. Footer */}
      <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs font-medium text-slate-400 sm:flex-row">
        <p>© {new Date().getFullYear()} PeopleSync Technologies. All rights reserved.</p>

        <div className="flex items-center gap-3">
          <button type="button" className="hover:text-slate-600 transition">
            Privacy Policy
          </button>
          <span aria-hidden="true">•</span>
          <button type="button" className="hover:text-slate-600 transition">
            Terms &amp; Conditions
          </button>
        </div>
      </div>
    </div>
  );
}
