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
import QuickActionsCard from "./QuickActionsCard";
import RecentActivityCard from "./RecentActivityCard";
import RecruitmentFunnel from "../recruitment/RecruitmentFunnel";
import UpcomingInterviewsCard from "../recruitment/UpcomingInterviewsCard";
import { useDashboardMetrics } from "./useDashboardMetrics";
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
    return fullName ? fullName.split(" ")[0] : "Atharv";
  } catch {
    return "Atharv";
  }
}

export default function AdminDashboard({
  totalHeadcount,
  recentActivities = [],
  onNavigate,
}: AdminDashboardProps) {
  const firstName = useMemo(() => readUserFirstName(), []);

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const showHrWidgets = isHrAdmin();
  const { metrics, refresh } = useDashboardMetrics(totalHeadcount ?? null);

  return (
    <div className="space-y-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      {/* 1. Hero Greeting Banner (Matches PeopleSync mockup) */}
      <div className="relative overflow-hidden rounded-3xl border border-blue-100/60 bg-gradient-to-r from-[#e8f1ff] via-[#edf5ff] to-[#f4f8ff] p-6 shadow-xs sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between">
        {/* Left: Greeting + Waving Hand */}
        <div className="flex items-center gap-4.5 z-10">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200/70 text-3xl shadow-xs">
            👋
          </div>
          <div>
            <h1 className="text-2xl sm:text-[26px] font-extrabold text-[#0f172a] font-manrope tracking-tight">
              {greeting}, {firstName}!
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
              Here's what's happening in your organization today.
            </p>
          </div>
        </div>

        {/* Right: Modern Workstation Illustration */}
        <div className="hidden md:flex items-center justify-end pointer-events-none select-none relative h-24 w-72 lg:w-80 opacity-95">
          <svg viewBox="0 0 320 110" fill="none" className="h-full w-full">
            {/* Background building silhouettes */}
            <rect x="25" y="32" width="16" height="78" rx="3" fill="#bfdbfe" fillOpacity="0.45" />
            <rect x="45" y="14" width="20" height="96" rx="3" fill="#93c5fd" fillOpacity="0.4" />
            <rect x="69" y="44" width="15" height="66" rx="3" fill="#bfdbfe" fillOpacity="0.35" />

            {/* Table surface line */}
            <line x1="70" y1="102" x2="310" y2="102" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6" />

            {/* Laptop Base and Screen */}
            <rect x="150" y="55" width="70" height="42" rx="4" fill="#0f172a" />
            <rect x="154" y="59" width="62" height="34" rx="2" fill="#0066ff" fillOpacity="0.88" />
            <line x1="161" y1="68" x2="186" y2="68" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.9" />
            <line x1="161" y1="74" x2="202" y2="74" stroke="#bfdbfe" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="161" y1="80" x2="180" y2="80" stroke="#bfdbfe" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M142 98 L228 98 L222 102 L148 102 Z" fill="#64748b" />
            <rect x="175" y="99" width="20" height="2" rx="1" fill="#cbd5e1" />

            {/* Potted Plant */}
            <path d="M255 82 L269 82 L266 102 L258 102 Z" fill="#3b82f6" fillOpacity="0.85" />
            <path d="M262 82 C255 70 248 70 245 74 C252 78 259 80 262 82 Z" fill="#10b981" />
            <path d="M262 82 C265 65 275 66 278 72 C272 76 265 80 262 82 Z" fill="#059669" />
            <path d="M262 82 C260 62 268 58 271 63 C268 70 264 78 262 82 Z" fill="#34d399" />

            {/* Coffee mug */}
            <rect x="118" y="85" width="14" height="17" rx="3" fill="#ff6b00" fillOpacity="0.9" />
            <path d="M132 89 C136 89 136 95 132 95" stroke="#ff6b00" strokeWidth="2" fill="none" />

            {/* Soft floating stars/dots */}
            <circle cx="100" cy="45" r="2.5" fill="#3b82f6" fillOpacity="0.5" />
            <circle cx="284" cy="38" r="3" fill="#ff6b00" fillOpacity="0.5" />
            <circle cx="130" cy="28" r="1.5" fill="#60a5fa" fillOpacity="0.6" />
          </svg>
        </div>
      </div>

      {/* 2. Top 4 KPI Metrics Row */}
      <DashboardKpiRow
        metrics={metrics}
        onOpenLeave={() => onNavigate("Leave")}
        onOpenPayroll={() => onNavigate("Payroll")}
        onOpenEmployees={() => onNavigate("Employees")}
        onOpenAttendance={() => onNavigate("Attendance")}
      />

      {/* 3. Middle Row: Attendance Overview + Performance & Appraisal */}
      <div className="grid grid-cols-12 gap-5">
        <AttendanceTrendChart className="col-span-12 lg:col-span-7" />
        <PerformanceSummaryCard
          className="col-span-12 lg:col-span-5"
          onViewDetails={() => onNavigate("Employees")}
        />
      </div>

      {/* 4. Bottom Row: Employee by Department + Quick Actions + Recent Activities */}
      <div className="grid grid-cols-12 gap-5">
        <DepartmentDonut
          counts={metrics.departmentCounts}
          className="col-span-12 lg:col-span-4"
          onViewAll={() => onNavigate("Employees")}
        />

        <QuickActionsCard
          className="col-span-12 lg:col-span-4"
          onNavigate={onNavigate}
        />

        <RecentActivityCard
          activities={recentActivities}
          className="col-span-12 lg:col-span-4"
          onViewAll={() => onNavigate("Announcement")}
        />
      </div>

      {/* 5. Operations & HR Details Section */}
      <div className="mt-8 border-t border-slate-100 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Operations &amp; Pending Items
          </h3>
        </div>

        <div className="grid grid-cols-12 gap-5">
          <PendingLeaveRequestsCard
            onOpenLeave={() => onNavigate("Leave")}
            onChanged={refresh}
          />
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
