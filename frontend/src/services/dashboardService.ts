import { api } from "./api";
import type { Celebration } from "../types/celebration";

export type { Celebration, CelebrationType } from "../types/celebration";

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