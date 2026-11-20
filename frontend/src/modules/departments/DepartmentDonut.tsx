import { useEffect, useState } from "react";
import { ChevronRight, Users } from "lucide-react";

import {
  type DepartmentShare,
} from "../dashboard/dashboardData";
import type { DepartmentCount } from "../dashboard/useDashboardMetrics";
import {
  prefersReducedMotion,
  useCountUp,
} from "../dashboard/useDashboardAnimation";

const DONUT_RADIUS = 56;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const STROKE_WIDTH = 22;

function useRingFill(duration = 1000): number {
  const [progress, setProgress] = useState(() =>
    prefersReducedMotion() ? 1 : 0,
  );

  useEffect(() => {
    if (prefersReducedMotion()) {
      const frame = requestAnimationFrame(() => setProgress(1));
      return () => cancelAnimationFrame(frame);
    }

    let frame: number | null = null;
    let start: number | null = null;

    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const ratio = Math.min((timestamp - start) / duration, 1);
      setProgress(1 - Math.pow(1 - ratio, 3));
      if (ratio < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [duration]);

  return progress;
}

interface DepartmentDonutProps {
  counts?: DepartmentCount[] | null;
  className?: string;
  onViewAll?: () => void;
}

export default function DepartmentDonut({
  counts,
  className = "col-span-12 md:col-span-6 xl:col-span-4",
  onViewAll,
}: DepartmentDonutProps) {
  const progress = useRingFill();

  // If live counts exist and has entries, use them; otherwise show the reference default breakdown
  const shares: DepartmentShare[] =
    counts && counts.length > 0
      ? counts.map((count, index) => ({
          label: count.label,
          value: count.value,
          color: index === 0 ? "#0066ff" : index === 1 ? "#8b5cf6" : "#f97316",
        }))
      : [
          { label: "Dev", value: 1, color: "#0066ff" },
          { label: "HR", value: 1, color: "#8b5cf6" },
        ];

  const total = shares.reduce((sum, share) => sum + share.value, 0);
  const animatedTotal = useCountUp(total, 1000);

  const segments =
    total > 0
      ? shares.map((share, index) => {
          const segmentLength = (share.value / total) * DONUT_CIRCUMFERENCE;
          const offset = shares
            .slice(0, index)
            .reduce(
              (sum, prev) =>
                sum + (prev.value / total) * DONUT_CIRCUMFERENCE,
              0,
            );
          return { ...share, dash: segmentLength * progress, offset };
        })
      : [];

  return (
    <div
      className={`rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-4.5 w-4.5 text-[#0066ff]" />
          <h2 className="text-base font-bold text-[#0f172a] font-manrope">
            Employee by Department
          </h2>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0066ff] hover:underline"
        >
          View All
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Donut and Legend */}
      <div className="flex items-center justify-between gap-4">
        {/* SVG Donut Ring */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg viewBox="0 0 160 160" className="h-[125px] w-[125px]" role="img">
            <g transform="translate(80, 80) rotate(-90)">
              <circle
                r={DONUT_RADIUS}
                fill="none"
                stroke="#f1f5f9"
                strokeWidth={STROKE_WIDTH}
              />
              {segments.map((segment) => (
                <circle
                  key={segment.label}
                  r={DONUT_RADIUS}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={`${segment.dash} ${
                    DONUT_CIRCUMFERENCE - segment.dash
                  }`}
                  strokeDashoffset={-segment.offset}
                />
              ))}
            </g>

            <text
              x="80"
              y="77"
              textAnchor="middle"
              className="fill-slate-900 text-[24px] font-extrabold font-manrope"
            >
              {Math.round(animatedTotal)}
            </text>

            <text
              x="80"
              y="93"
              textAnchor="middle"
              className="fill-slate-400 text-[10px] font-medium"
            >
              Total
            </text>
          </svg>
        </div>

        {/* Legend List */}
        <ul className="min-w-0 flex-1 space-y-2.5 pl-2">
          {shares.map((share) => (
            <li
              key={share.label}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: share.color }}
                />
                <span className="truncate font-semibold text-slate-700">
                  {share.label}
                </span>
              </div>

              <div className="flex items-center gap-2 tabular-nums">
                <span className="font-bold text-slate-900">{share.value}</span>
                <span className="text-[11px] font-medium text-slate-400 w-11 text-right">
                  {total > 0 ? ((share.value / total) * 100).toFixed(1) : "0.0"}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
