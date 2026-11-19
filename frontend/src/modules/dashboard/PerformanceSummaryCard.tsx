import { Calendar, ChevronRight, Settings, Star, User } from "lucide-react";

interface PerformanceSummaryCardProps {
  summary?: unknown;
  className?: string;
  onViewDetails?: () => void;
}

export default function PerformanceSummaryCard({
  className = "col-span-12 lg:col-span-5",
  onViewDetails,
}: PerformanceSummaryCardProps) {
  const percentage = 68;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className={`rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Star className="h-4.5 w-4.5 text-[#0066ff] fill-[#0066ff]/20" />
            <h2 className="text-base font-bold text-[#0f172a] font-manrope">
              Performance &amp; Appraisal
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-400 font-medium">
            Annual Review 2026
          </p>
        </div>

        <button
          type="button"
          onClick={onViewDetails}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0066ff] hover:underline"
        >
          View Details
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Main Content: Donut + Side List */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
        {/* Donut Gauge */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            <svg className="h-28 w-28 -rotate-90 transform" viewBox="0 0 100 100">
              {/* Background Track */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="text-slate-100"
                strokeWidth="10"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Progress Stroke */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="text-[#0066ff] transition-all duration-1000 ease-out"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>

            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-[#0f172a] font-manrope">
                {percentage}%
              </span>
            </div>
          </div>
          <span className="mt-2 text-xs font-semibold text-slate-500 text-center">
            Overall Progress
          </span>
        </div>

        {/* Side Details List */}
        <div className="sm:col-span-7 space-y-3">
          {/* Appraisal Cycle */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50/70 p-2.5">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-600" />
              <span className="text-xs font-semibold text-slate-700">
                Appraisal Cycle
              </span>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-100">
              Active
            </span>
          </div>

          {/* No Active Cycle */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50/70 p-2.5">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-slate-600" />
              <span className="text-xs font-semibold text-slate-700">
                No Active Cycle
              </span>
            </div>
            <span className="text-xs font-semibold text-slate-400">-</span>
          </div>

          {/* Next Review */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50/70 p-2.5">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-600" />
              <span className="text-xs font-semibold text-slate-700">
                Next Review
              </span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#0066ff]">
              <Calendar className="h-3 w-3" />
              31 Dec 2026
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
