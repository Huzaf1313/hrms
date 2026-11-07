import { api } from "./api";
import type { Celebration } from "../types/celebration";

export type { Celebration, CelebrationType } from "../types/celebration";

export interface HiringPipeline {
  applied: number;
  screened: number;
  interview: number;
  offered: number;
}

export interface RecentActivity {
  id: string;
  text: string;
  actor_name: string;
  target: string | null;
  created_at: string;
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
  announcement_titles: string[];
  hiring_pipeline: HiringPipeline;
  recent_activities: RecentActivity[];
  payroll_summary?: DashboardPayrollSummary | null;
}

export async function getDashboardData(): Promise<DashboardData> {
  return api.get<DashboardData>("/dashboard");
}
