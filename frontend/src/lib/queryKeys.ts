/**
 * Query Key Factory for HRMS TanStack Query cache.
 *
 * Scopes:
 * - `reference`: Shared static/configuration data (departments, shifts, salary structures, deductions, holidays).
 * - `admin`: Organization-wide administrative queries (metrics, summaries, analytics, employee list).
 * - `employee`: Strictly scoped by employee ID to prevent any cross-user data leakage.
 */
export const queryKeys = {
  reference: {
    departments: () => ["reference", "departments"] as const,
    shifts: () => ["reference", "shifts"] as const,
    salaryStructures: () => ["reference", "salaryStructures"] as const,
    deductions: () => ["reference", "deductions"] as const,
    holidays: () => ["reference", "holidays"] as const,
  },

  admin: {
    dashboard: () => ["admin", "dashboard"] as const,
    dashboardMetrics: () => ["admin", "dashboardMetrics"] as const,
    announcements: () => ["admin", "announcements"] as const,
    attendanceSummary: (date: string, deptId?: string) =>
      ["admin", "attendance", "summary", { date, deptId: deptId || "" }] as const,
    attendanceTrend: (startDate: string, endDate: string, deptId?: string) =>
      ["admin", "attendance", "trend", { startDate, endDate, deptId: deptId || "" }] as const,
    attendanceOptions: () => ["admin", "attendance", "options"] as const,
    attendanceList: (params: Record<string, unknown>) =>
      ["admin", "attendance", "list", params] as const,
    leaveSummary: () => ["admin", "leave", "summary"] as const,
    recruitmentStats: () => ["admin", "recruitment", "stats"] as const,
    recruitmentInterviews: (limit: number) =>
      ["admin", "recruitment", "interviews", limit] as const,
    payrollAnalytics: (params?: { year?: number; months?: number }) =>
      params && Object.keys(params).length > 0
        ? (["admin", "payroll", "analytics", params] as const)
        : (["admin", "payroll", "analytics"] as const),
    employees: (filters?: Record<string, unknown>) =>
      ["admin", "employees", filters ?? {}] as const,
  },

  employee: {
    attendance: (employeeId: string, params?: Record<string, unknown>) =>
      ["employee", employeeId, "attendance", params ?? {}] as const,
    leaves: (employeeId: string) =>
      ["employee", employeeId, "leaves"] as const,
    leaveBalances: (employeeId: string) =>
      ["employee", employeeId, "leaveBalances"] as const,
    payroll: (employeeId: string, params?: Record<string, unknown>) =>
      ["employee", employeeId, "payroll", params ?? {}] as const,
    payrollLatest: (employeeId: string) =>
      ["employee", employeeId, "payroll", "latest"] as const,
    announcements: () => ["employee", "announcements"] as const,
  },
};
