import { useEffect, useState } from "react";

import DashboardCard from "../dashboard/DashboardCard";

import {
  DEPARTMENT_COLORS,
  type DepartmentShare,
} from "../dashboard/dashboardData";
import type { DepartmentCount } from "../dashboard/useDashboardMetrics";
import {
  prefersReducedMotion,
  useCountUp,
} from "../dashboard/useDashboardAnimation";

const DONUT_RADIUS = 62;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const STROKE_WIDTH = 26;

/** Drives every segment from one rAF loop so the ring fills as a whole. */
function useRingFill(duration = 1100): number {
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
      if (start === null) {
        start = timestamp;
      }

      const ratio = Math.min((timestamp - start) / duration, 1);

      setProgress(1 - Math.pow(1 - ratio, 3));

      if (ratio < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [duration]);

  return progress;
}

interface DepartmentDonutProps {
  /** Headcount per department from live data. */
  counts: DepartmentCount[] | null;
}

export default function DepartmentDonut({ counts }: DepartmentDonutProps) {
  const progress = useRingFill();

  const shares: DepartmentShare[] = counts && counts.length > 0
    ? counts.map((count, index) => ({
        label: count.label,
        value: count.value,
        color: DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length],
      }))
    : [];

  const total = shares.reduce((sum, share) => sum + share.value, 0);
  const animatedTotal = useCountUp(total, 1200);

  const segments = total > 0
    ? shares.map((share, index) => {
        const segmentLength = (share.value / total) * DONUT_CIRCUMFERENCE;

        // Cumulative arc length of the preceding segments, so each slice starts
        // where the previous one ended.
        const offset = shares
          .slice(0, index)
          .reduce(
            (sum, previous) =>
              sum + (previous.value / total) * DONUT_CIRCUMFERENCE,
            0,
          );

        return { ...share, dash: segmentLength * progress, offset };
      })
    : [];

  return (
    <DashboardCard
      title="Employee by Department"
      className="col-span-12 md:col-span-6 xl:col-span-4"
    >
      {shares.length === 0 || total === 0 ? (
        <div className="flex h-36 items-center justify-center text-xs text-gray-400">
          No department data available.
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <svg
            viewBox="0 0 160 160"
            className="h-[132px] w-[132px] shrink-0"
            role="img"
            aria-label="Employee distribution by department"
          >
            <g transform="translate(80, 80) rotate(-90)">
              <circle
                r={DONUT_RADIUS}
                fill="none"
                stroke="#f8fafc"
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
              y="76"
              textAnchor="middle"
              className="fill-gray-900 text-[22px] font-bold"
            >
              {Math.round(animatedTotal)}
            </text>

            <text
              x="80"
              y="94"
              textAnchor="middle"
              className="fill-gray-400 text-[9px]"
            >
              Total Employees
            </text>
          </svg>

          <ul className="min-w-0 flex-1 space-y-1">
            {shares.map((share, index) => (
              <li
                key={share.label}
                className="dashboard-fade-in flex items-center gap-1.5 text-[10px]"
                style={{ animationDelay: `${700 + index * 90}ms` }}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: share.color }}
                />

                <span className="min-w-0 flex-1 truncate text-gray-600">
                  {share.label}
                </span>

                <span className="shrink-0 font-semibold text-gray-800">
                  {share.value}
                </span>

                <span className="w-11 shrink-0 text-right text-gray-400">
                  {total > 0 ? ((share.value / total) * 100).toFixed(1) : "0.0"}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardCard>
  );
}