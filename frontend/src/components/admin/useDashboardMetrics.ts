import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { attendanceService } from "../../services/attendanceService";
import { departmentService } from "../../services/departmentService";
import { employeeService } from "../../services/employeeService";
import { leaveService } from "../../services/admin_leave_service";
import { recruitmentService } from "../../services/recruitmentService";
import { getDashboardData } from "../../services/dashboardService";
import type { DashboardPerformanceSummary } from "../../services/dashboardService";
import type {
  CandidateStage,
  UpcomingInterview,
} from "../../types/recruitment";
import { queryKeys } from "../../lib/queryKeys";
import { DEPARTMENT_COLORS } from "./dashboardData";

export interface DepartmentCount {
  label: string;
  value: number;
}

export interface DashboardMetrics {
  totalEmployees: number | null;
  presentToday: number | null;
  presentPercent: number | null;
  onLeaveToday: number | null;
  onLeavePercent: number | null;
  pendingLeaveRequests: number | null;
  departmentCounts: DepartmentCount[] | null;
  /** Candidates sitting at each pipeline stage, as the recruitment board counts them. */
  recruitmentStageCounts: Record<CandidateStage, number> | null;
  activeJobPositions: number | null;
  /** Booked interviews still ahead of now, soonest first. */
  upcomingInterviews: UpcomingInterview[] | null;
  payrollThisMonth: number | null;
  payrollChangePercent: number | null;
  totalExpensesThisMonth: number | null;
  expenseChangePercent: number | null;
  isPayrollLoading: boolean;
  performanceSummary: DashboardPerformanceSummary | null;
}

export interface DashboardMetricsState {
  metrics: DashboardMetrics;
  /** Re-runs every request, so the KPIs follow admin actions on the page. */
  refresh: () => void;
}

/** How many interviews the dashboard card shows. */
const UPCOMING_INTERVIEW_LIMIT = 6;

const EMPTY_METRICS: DashboardMetrics = {
  totalEmployees: null,
  presentToday: null,
  presentPercent: null,
  onLeaveToday: null,
  onLeavePercent: null,
  pendingLeaveRequests: null,
  departmentCounts: null,
  recruitmentStageCounts: null,
  activeJobPositions: null,
  upcomingInterviews: null,
  payrollThisMonth: null,
  payrollChangePercent: null,
  totalExpensesThisMonth: null,
  expenseChangePercent: null,
  isPayrollLoading: false,
  performanceSummary: null,
};

/** Local calendar date, so the summary matches the server's IST day. */
function todayKey(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Loads the dashboard figures with TanStack Query caching and deduplication.
 *
 * Each metric is settled independently and cached according to volatility:
 * - Attendance summary: 60s
 * - Leave summary: 2m
 * - Active employees: 5m
 * - Departments: 10m
 * - Recruitment stats & interviews: 3m
 *
 * Navigating between dashboard tabs reuses fresh data without hitting MongoDB.
 */
export function useDashboardMetrics(
  seedTotalEmployees: number | null,
): DashboardMetricsState {
  const queryClient = useQueryClient();
  const currentTodayKey = todayKey();

  const attendanceQuery = useQuery({
    queryKey: queryKeys.admin.attendanceSummary(currentTodayKey),
    queryFn: () => attendanceService.summary(currentTodayKey),
    staleTime: 60 * 1000,
  });

  const leaveQuery = useQuery({
    queryKey: queryKeys.admin.leaveSummary(),
    queryFn: () => leaveService.summary(),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 30 * 1000,
  });

  const employeesQuery = useQuery({
    queryKey: queryKeys.admin.employees({ status: "active" }),
    queryFn: () => employeeService.listAll({ status: "active" }),
    staleTime: 5 * 60 * 1000,
  });

  const departmentsQuery = useQuery({
    queryKey: queryKeys.reference.departments(),
    queryFn: () => departmentService.listAll(),
    staleTime: 10 * 60 * 1000,
  });

  const recruitmentStatsQuery = useQuery({
    queryKey: queryKeys.admin.recruitmentStats(),
    queryFn: () => recruitmentService.getStats(),
    staleTime: 3 * 60 * 1000,
  });

  const upcomingInterviewsQuery = useQuery({
    queryKey: queryKeys.admin.recruitmentInterviews(UPCOMING_INTERVIEW_LIMIT),
    queryFn: () =>
      recruitmentService.getUpcomingInterviews(UPCOMING_INTERVIEW_LIMIT),
    staleTime: 3 * 60 * 1000,
  });

  const dashboardQuery = useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: () => getDashboardData(),
    staleTime: 60 * 1000,
  });

  const metrics = useMemo<DashboardMetrics>(() => {
    const next: DashboardMetrics = { ...EMPTY_METRICS };

    if (seedTotalEmployees) {
      next.totalEmployees = seedTotalEmployees;
    }

    if (attendanceQuery.data) {
      const summary = attendanceQuery.data;
      next.presentToday = summary.present_count ?? null;
      next.presentPercent = summary.present_percentage ?? null;
      next.onLeaveToday = summary.on_leave_count ?? null;
      next.onLeavePercent = summary.on_leave_percentage ?? null;

      if (!next.totalEmployees && summary.total_employees > 0) {
        next.totalEmployees = summary.total_employees;
      }
    }

    if (leaveQuery.data) {
      next.pendingLeaveRequests = leaveQuery.data.pending_requests ?? null;
    }

    if (recruitmentStatsQuery.data) {
      next.recruitmentStageCounts = recruitmentStatsQuery.data.stage_counts;
      next.activeJobPositions =
        recruitmentStatsQuery.data.active_job_positions ?? null;
    }

    if (upcomingInterviewsQuery.data) {
      next.upcomingInterviews = upcomingInterviewsQuery.data;
    }

    const payrollSummary = dashboardQuery.data?.payroll_summary;
    if (payrollSummary) {
      next.payrollThisMonth = payrollSummary.payroll_this_month;
      next.payrollChangePercent = payrollSummary.payroll_change_percent;
      next.totalExpensesThisMonth = payrollSummary.total_expenses;
      next.expenseChangePercent = payrollSummary.expense_change_percent;
    } else if (dashboardQuery.isSuccess) {
      next.payrollThisMonth = 0;
      next.payrollChangePercent = 0;
      next.totalExpensesThisMonth = 0;
      next.expenseChangePercent = 0;
    }
    next.isPayrollLoading = dashboardQuery.isLoading;
    next.performanceSummary = dashboardQuery.data?.performance_summary ?? null;

    // Department headcount: the attendance summary already reports total
    // employees per department, so one call covers the donut.
    if (attendanceQuery.data) {
      const presence = attendanceQuery.data.department_presence ?? [];

      const counts = presence
        .filter((entry) => entry.total_employees > 0)
        .map((entry) => ({
          label: entry.department_name,
          value: entry.total_employees,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, DEPARTMENT_COLORS.length);

      if (counts.length > 0) {
        next.departmentCounts = counts;
      }
    }

    // Fall back to counting active employees per department when the summary
    // carries no per-department breakdown.
    if (
      !next.departmentCounts &&
      employeesQuery.data &&
      departmentsQuery.data &&
      employeesQuery.data.length > 0
    ) {
      const nameById = new Map(
        departmentsQuery.data.map((department) => [
          department.id,
          department.name,
        ]),
      );

      const counts = new Map<string, number>();

      for (const employee of employeesQuery.data) {
        const name = nameById.get(employee.department_id) ?? "Unassigned";
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }

      next.departmentCounts = [...counts.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, DEPARTMENT_COLORS.length);
    }

    return next;
  }, [
    seedTotalEmployees,
    attendanceQuery.data,
    leaveQuery.data,
    recruitmentStatsQuery.data,
    upcomingInterviewsQuery.data,
    dashboardQuery.data,
    dashboardQuery.isLoading,
    dashboardQuery.isSuccess,
    employeesQuery.data,
    departmentsQuery.data,
  ]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.dashboard(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.attendanceSummary(currentTodayKey),
    });
    // The trend chart covers whichever month is open, so every range is
    // refreshed - the month is part of the key, not the prefix.
    void queryClient.invalidateQueries({
      queryKey: ["admin", "attendance", "trend"],
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.leaveSummary(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.employees({ status: "active" }),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.reference.departments(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.recruitmentStats(),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.admin.recruitmentInterviews(UPCOMING_INTERVIEW_LIMIT),
    });
  }, [queryClient, currentTodayKey]);

  return { metrics, refresh };
}
