import { api } from "./api";

export interface MonthlyPayrollItem {
  month: string;
  month_name: string;
  year: number;
  month_num: number;
  gross: number;
  deductions: number;
  net: number;
  total_expense: number;
  employee_count: number;
  records_count: number;
}

export interface PayrollSummaryMetrics {
  total_employees: number;
  processed_payroll: number;
  pending_payroll: number;
  total_payroll_amount: number;
  latest_month: string;
  period_gross: number;
  period_deductions: number;
  period_net: number;
  period_expense: number;
}

export interface PayrollRecentRun {
  month: string;
  processed_on: string;
  progress: string;
  status: string;
}

export interface PayrollDepartmentSummary {
  department: string;
  employees: number;
  gross: number;
  net: number;
  status: string;
}

export interface PayrollAnalyticsData {
  timeline: MonthlyPayrollItem[];
  summary: PayrollSummaryMetrics;
  available_years: number[];
  recent_runs: PayrollRecentRun[];
  departments: PayrollDepartmentSummary[];
}

export interface PayrollAnalyticsParams {
  [key: string]: string | number | boolean | undefined;
  year?: number;
  months?: number;
  /** Narrows the whole response to one payroll month. Requires year. */
  month?: number;
}

export const adminPayrollService = {
  getAnalytics: (params?: PayrollAnalyticsParams) =>
    api.get<PayrollAnalyticsData>("/admin-payslip/analytics", params),
};

