import { api } from "./api";
import type { Celebration } from "../types/celebration";

export type { Celebration, CelebrationType } from "../types/celebration";

export interface HiringPipeline {
  applied: number;
  screened: number;
  interview: number;
  offered: number;
}

export interface DashboardPayrollSummary {
  payroll_this_month: number;
  payroll_change_percent: number;
  total_expenses: number;
  expense_change_percent: number;
  processed_count: number;
  currency: string;
}

export interface DashboardData {
  total_headcount: number;
  attendance_rate: number | null;
  on_leave_today: number;
  celebrations: Celebration[];
  hiring_pipeline: HiringPipeline;
  payroll_summary?: DashboardPayrollSummary | null;
}

export async function getDashboardData(): Promise<DashboardData> {
  return api.get<DashboardData>("/dashboard");
}