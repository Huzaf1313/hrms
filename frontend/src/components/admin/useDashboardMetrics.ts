import { useCallback, useEffect, useState } from "react";

import { attendanceService } from "../../services/attendanceService";
import { departmentService } from "../../services/departmentService";
import { employeeService } from "../../services/employeeService";
import { leaveService } from "../../services/admin_leave_service";

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
}

export interface DashboardMetricsState {
  metrics: DashboardMetrics;
  /** Re-runs every request, so the KPIs follow admin actions on the page. */
  refresh: () => void;
}

const EMPTY_METRICS: DashboardMetrics = {
  totalEmployees: null,
  presentToday: null,
  presentPercent: null,
  onLeaveToday: null,
  onLeavePercent: null,
  pendingLeaveRequests: null,
  departmentCounts: null,
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
 * Loads the dashboard figures that the API can already answer.
 *
 * Every request is settled independently and each metric stays `null` when its
 * endpoint is missing or fails, so the UI can keep showing the placeholder for
 * that one card instead of blanking the whole dashboard.
 */
export function useDashboardMetrics(
  seedTotalEmployees: number | null,
): DashboardMetricsState {
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    void Promise.allSettled([
      attendanceService.summary(todayKey()),
      leaveService.summary(),
      employeeService.listAll({ status: "active" }),
      departmentService.listAll(),
    ]).then(([attendance, leave, employees, departments]) => {
      const next: DashboardMetrics = { ...EMPTY_METRICS };

      if (seedTotalEmployees) {
        next.totalEmployees = seedTotalEmployees;
      }

      if (attendance.status === "fulfilled") {
        const summary = attendance.value;

        next.presentToday = summary.present_count ?? null;
        next.presentPercent = summary.present_percentage ?? null;
        next.onLeaveToday = summary.on_leave_count ?? null;
        next.onLeavePercent = summary.on_leave_percentage ?? null;

        if (!next.totalEmployees && summary.total_employees > 0) {
          next.totalEmployees = summary.total_employees;
        }
      }

      if (leave.status === "fulfilled") {
        next.pendingLeaveRequests = leave.value.pending_requests ?? null;
      }

      // Department headcount: the attendance summary already reports total
      // employees per department, so one call covers the donut.
      if (attendance.status === "fulfilled") {
        const presence = attendance.value.department_presence ?? [];

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
        employees.status === "fulfilled" &&
        departments.status === "fulfilled" &&
        employees.value.length > 0
      ) {
        const nameById = new Map(
          departments.value.map((department) => [
            department.id,
            department.name,
          ]),
        );

        const counts = new Map<string, number>();

        for (const employee of employees.value) {
          const name =
            nameById.get(employee.department_id) ?? "Unassigned";

          counts.set(name, (counts.get(name) ?? 0) + 1);
        }

        next.departmentCounts = [...counts.entries()]
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, DEPARTMENT_COLORS.length);
      }

      if (active) {
        setMetrics(next);
      }
    });

    return () => {
      active = false;
    };
  }, [seedTotalEmployees, reloadToken]);

  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return { metrics, refresh };
}