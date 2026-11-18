import type { CSSProperties } from "react";
import { Award, Clock, Star, Target } from "lucide-react";
import DashboardCard from "./DashboardCard";
import type { DashboardPerformanceSummary } from "../../services/dashboardService";

interface PerformanceSummaryCardProps {
  summary?: DashboardPerformanceSummary | null;
  className?: string;
}

export default function PerformanceSummaryCard({
  summary,
  className = "col-span-12 md:col-span-6 xl:col-span-4",
}: PerformanceSummaryCardProps) {
  const activeCycle = summary?.active_cycle || "Annual Review 2026";
  const totalReviews = summary?.total_reviews ?? 0;
  const completedReviews = summary?.completed_reviews ?? 0;
  const pendingReviews = summary?.pending_reviews ?? 0;
  const avgRating = summary?.average_rating ?? 0;
  const goalsMetPct = summary?.goals_met_pct ?? 0;

  const completionPct =
    totalReviews > 0 ? Math.round((completedReviews / totalReviews) * 100) : 0;

  return (
    <DashboardCard
      title="Performance & Appraisal"
      eyebrow={activeCycle}
      className={className}
    >
      <div className="space-y-3">
        {/* Appraisal Cycle Completion */}
        <div
          className="dashboard-rise rounded-xl border border-gray-100 bg-gray-50/60 p-3"
          style={{ "--dashboard-delay": "100ms" } as CSSProperties}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-gray-700">
              <Award className="h-4 w-4 text-[#2563eb]" />
              Appraisal Cycle Completion
            </span>
            <span className="font-bold text-gray-900">
              {totalReviews > 0 ? `${completionPct}%` : "No Active Cycle"}
            </span>
          </div>

          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[#2563eb] transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
            <span>{completedReviews} Completed</span>
            <span>{totalReviews} Total Reviews</span>
          </div>
        </div>

        {/* 2-Column Metrics: Average Rating & Goals Met */}
        <div className="grid grid-cols-2 gap-2.5">
          <div
            className="dashboard-rise flex items-center gap-2.5 rounded-xl border border-amber-100 bg-amber-50/50 p-2.5"
            style={{ "--dashboard-delay": "180ms" } as CSSProperties}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase text-gray-500">
                Avg Rating
              </p>
              <p className="text-[14px] font-bold text-gray-900">
                {avgRating > 0 ? `${avgRating} / 5.0` : "--"}
              </p>
            </div>
          </div>

          <div
            className="dashboard-rise flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5"
            style={{ "--dashboard-delay": "240ms" } as CSSProperties}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <Target className="h-4 w-4 text-emerald-600" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase text-gray-500">
                Goals Met
              </p>
              <p className="text-[14px] font-bold text-gray-900">
                {completedReviews > 0 ? `${goalsMetPct}%` : "--"}
              </p>
            </div>
          </div>
        </div>

        {/* Pending Reviews Pill */}
        <div
          className="dashboard-rise flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2 text-xs"
          style={{ "--dashboard-delay": "300ms" } as CSSProperties}
        >
          <span className="flex items-center gap-1.5 text-gray-600">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            Pending Reviews:
          </span>
          <span className="font-semibold text-gray-800">
            {pendingReviews} pending
          </span>
        </div>
      </div>
    </DashboardCard>
  );
}
