import { api } from "./api";

export interface Celebration {
  name: string;
  type: string;
}

export interface HiringPipeline {
  applied: number;
  screened: number;
  interview: number;
  offered: number;
}

export interface DashboardData {
  total_headcount: number;
  attendance_rate: number | null;
  on_leave_today: number;
  celebrations: Celebration[];
  hiring_pipeline: HiringPipeline;
}

export async function getDashboardData(): Promise<DashboardData> {
  return api.get<DashboardData>("/dashboard");
}