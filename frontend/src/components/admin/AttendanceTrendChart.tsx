import { useState } from "react";
import { ChevronDown } from "lucide-react";

import DashboardCard from "./DashboardCard";

import {
  attendanceMonthLabel,
  attendanceMonthOptions,
  attendanceSeries,
  type AttendancePoint,
} from "./dashboardData";

const CHART_WIDTH = 620;
const CHART_HEIGHT = 190;
const CHART_PADDING_TOP = 10;
const CHART_PADDING_BOTTOM = 8;
const CHART_MAX = 250;

const Y_TICKS = [0, 50, 100, 150, 200, 250];

const SERIES_META = [
  { key: "present", label: "Present", color: "#16a34a" },
  { key: "late", label: "Late", color: "#f97316" },
  { key: "absent", label: "Absent", color: "#ef4444" },
  { key: "onLeave", label: "On Leave", color: "#a855f7" },
] as const;

type SeriesKey = (typeof SERIES_META)[number]["key"];

const USABLE_HEIGHT =
  CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

function buildSeriesPoints(
  series: AttendancePoint[],
  key: SeriesKey,
  maxValue: number,
): string {
  const step =
    series.length > 1 ? CHART_WIDTH / (series.length - 1) : CHART_WIDTH;

  return series
    .map((point, index) => {
      const x = index * step;
      const ratio = maxValue === 0 ? 0 : point[key] / maxValue;
      const y = CHART_PADDING_TOP + USABLE_HEIGHT * (1 - ratio);

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function AttendanceTrendChart() {
  const [month, setMonth] = useState(attendanceMonthLabel);

  const peak = Math.max(
    ...attendanceSeries.flatMap((point) => [
      point.present,
      point.late,
      point.absent,
      point.onLeave,
    ]),
  );

  const areaPath = `M 0,${CHART_HEIGHT} L ${buildSeriesPoints(
    attendanceSeries,
    "present",
    CHART_MAX,
  ).replace(/ /g, " L ")} L ${CHART_WIDTH},${CHART_HEIGHT} Z`;

  const shortMonth = attendanceMonthLabel.split(" ")[0]?.slice(0, 3) ?? "";

  return (
    <DashboardCard
      title="Attendance Overview"
      eyebrow="Month"
      className="col-span-12 xl:col-span-4"
      action={
        <label className="relative">
          <span className="sr-only">Attendance month</span>

          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="cursor-pointer appearance-none rounded-full border border-gray-200 bg-white py-1 pl-3 pr-7 text-[11px] font-medium text-gray-600 outline-none transition hover:border-gray-300 focus:border-[#2563eb]"
          >
            {attendanceMonthOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
        </label>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {SERIES_META.map((series) => (
          <span
            key={series.key}
            className="dashboard-fade-in flex items-center gap-1.5 text-[11px] text-gray-600"
            style={{ animationDelay: "900ms" }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: series.color }}
            />
            {series.label}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="flex w-7 shrink-0 flex-col justify-between pb-1 text-right text-[9px] text-gray-300">
          {[...Y_TICKS].reverse().map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            className="h-[168px] w-full"
            role="img"
            aria-label="Daily attendance trend for the selected month"
          >
            {Y_TICKS.map((tick) => {
              const y =
                CHART_PADDING_TOP +
                USABLE_HEIGHT * (1 - tick / CHART_MAX);

              return (
                <line
                  key={tick}
                  x1={0}
                  x2={CHART_WIDTH}
                  y1={y}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            <path
              d={areaPath}
              fill="url(#attendance-area)"
              className="dashboard-fade-in"
              style={{ animationDelay: "1100ms" }}
            />

            {SERIES_META.map((series, index) => (
              <polyline
                key={series.key}
                points={buildSeriesPoints(
                  attendanceSeries,
                  series.key,
                  CHART_MAX,
                )}
                pathLength={1}
                fill="none"
                stroke={series.color}
                strokeWidth={series.key === "present" ? 2.4 : 1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="dashboard-line-draw"
                style={{ animationDelay: `${index * 220}ms` }}
              />
            ))}

            <defs>
              <linearGradient
                id="attendance-area"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#22c55e"
                  stopOpacity={0.22}
                />
                <stop
                  offset="100%"
                  stopColor="#22c55e"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
          </svg>

          {/* Labels sit on their own data point; even spacing would drift. */}
          <div className="relative mt-1 h-3 px-3 text-[9px] text-gray-300">
            {attendanceSeries
              .filter((point) => point.day % 5 === 0 || point.day === 1)
              .map((point) => {
                const percent =
                  ((point.day - 1) / (attendanceSeries.length - 1)) * 100;

                return (
                  <span
                    key={point.day}
                    className="absolute -translate-x-1/2 whitespace-nowrap"
                    style={{ left: `${percent}%` }}
                  >
                    {point.day} {shortMonth}
                  </span>
                );
              })}
          </div>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-gray-400">
        Peak {peak} · lines animate in on load
      </p>
    </DashboardCard>
  );
}