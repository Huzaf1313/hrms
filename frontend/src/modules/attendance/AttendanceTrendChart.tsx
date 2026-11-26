import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Calendar, ChevronDown, RotateCcw } from "lucide-react";

import { attendanceService } from "./attendanceService";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "../../components/ui/Button";

const CHART_WIDTH = 620;
const CHART_HEIGHT = 180;
const CHART_PADDING_TOP = 12;
const CHART_PADDING_BOTTOM = 12;

const SERIES_META = [
  { key: "present", label: "Present", color: "#2563EB" },
  { key: "late", label: "Late", color: "#F59E0B" },
  { key: "absent", label: "Absent", color: "#EF4444" },
  { key: "onLeave", label: "On Leave", color: "#60A5FA" },
] as const;

type SeriesKey = (typeof SERIES_META)[number]["key"];

interface TrendPoint {
  day: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
}

const USABLE_HEIGHT =
  CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function monthLabelOf(key: string): string {
  const [year, month] = key.split("-").map(Number);

  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function monthBounds(key: string): { start: string; end: string } {
  const [year, month] = key.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

const MONTH_OPTIONS: { key: string; label: string }[] = (() => {
  const options: { key: string; label: string }[] = [];
  const now = new Date();

  for (let back = 11; back >= 0; back -= 1) {
    const key = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - back, 1));
    options.push({ key, label: monthLabelOf(key) });
  }

  return options;
})();

function buildAxis(peak: number): { max: number; ticks: number[] } {
  if (peak <= 0) {
    return { max: 15, ticks: [0, 5, 10, 15] };
  }
  const max = Math.max(15, Math.ceil(peak / 5) * 5);
  const step = max / 3;
  return { max, ticks: [0, Math.round(step), Math.round(step * 2), max] };
}

function buildSeriesPoints(
  series: TrendPoint[],
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

interface AttendanceTrendChartProps {
  className?: string;
  summary?: {
    presentPercent: number | null;
    latePercent: number | null;
    onLeavePercent: number | null;
    absentPercent: number | null;
  };
}

export default function AttendanceTrendChart({
  className = "col-span-12 lg:col-span-7",
  summary,
}: AttendanceTrendChartProps) {
  const [month, setMonth] = useState(() => monthKeyOf(new Date()));

  const bounds = useMemo(() => monthBounds(month), [month]);

  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: queryKeys.admin.attendanceTrend(bounds.start, bounds.end),
    queryFn: () =>
      attendanceService.trend({
        start_date: bounds.start,
        end_date: bounds.end,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const liveSeries = useMemo<TrendPoint[]>(
    () =>
      (data?.days ?? []).map((day) => ({
        day: Number(day.date.slice(8, 10)),
        present: day.present,
        late: day.late,
        absent: day.absent,
        onLeave: day.on_leave,
      })),
    [data],
  );

  const series = liveSeries;

  const peak = useMemo(
    () =>
      Math.max(
        0,
        ...series.flatMap((point) => [
          point.present,
          point.late,
          point.absent,
          point.onLeave,
        ]),
      ),
    [series],
  );

  const { max, ticks } = useMemo(() => buildAxis(peak), [peak]);

  const areaPath = `M 0,${CHART_HEIGHT} L ${buildSeriesPoints(
    series,
    "present",
    max,
  ).replace(/ /g, " L ")} L ${CHART_WIDTH},${CHART_HEIGHT} Z`;

  const shortMonth = monthLabelOf(month).split(" ")[0]?.slice(0, 3) ?? "Nov";

  const xAxisIndices = useMemo(() => {
    const len = series.length;
    if (len <= 6) return series.map((_, i) => i);
    const step = Math.ceil((len - 1) / 5);
    const indices: number[] = [];
    for (let i = 0; i < len; i += step) {
      indices.push(i);
    }
    const last = len - 1;
    if (indices[indices.length - 1] !== last) {
      if (last - indices[indices.length - 1] < Math.max(2, Math.floor(step / 2))) {
        indices[indices.length - 1] = last;
      } else {
        indices.push(last);
      }
    }
    return indices;
  }, [series]);

  const showComparison =
    Boolean(summary) &&
    !isPending &&
    !isFetching &&
    !isError &&
    liveSeries.length > 0;

  return (
    <div
      className={`flex h-full flex-col rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-none ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-[18px] w-[18px] text-[#2563EB]" />
          <h2 className="text-[14px] font-semibold text-[#111827]">
            Attendance Overview
          </h2>
        </div>

        <label className="relative">
          <span className="sr-only">Attendance month</span>

          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
             className="cursor-pointer appearance-none rounded-md border border-[#E5E7EB] bg-white py-1.5 pl-3 pr-8 text-[12px] font-medium text-[#374151] outline-none transition hover:border-[#93C5FD] focus:border-[#2563EB]"
          >
            {MONTH_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>

          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </label>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {SERIES_META.map((meta) => (
          <span
            key={meta.key}
            className="flex items-center gap-2 text-xs font-medium text-slate-600"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: meta.color }}
            />
            {meta.label}
          </span>
        ))}
      </div>

      {(isPending || isFetching) && liveSeries.length === 0 ? (
        <div className="flex h-[150px] flex-col justify-center gap-3 animate-pulse" aria-label="Loading attendance">
          <div className="h-px w-full bg-[#E5E7EB]" />
          <div className="h-20 w-full rounded-lg bg-[#F3F4F6]" />
          <div className="h-px w-4/5 bg-[#E5E7EB]" />
        </div>
      ) : isError && liveSeries.length === 0 ? (
        <div className="flex min-h-[118px] flex-col items-center justify-center gap-3 text-center">
          <div className="flex items-center gap-2 text-[12px] text-[#B91C1C]">
            <AlertCircle className="h-4 w-4" />
            <span>Could not load live attendance data.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            Retry
          </Button>
        </div>
      ) : data && liveSeries.length === 0 ? (
        <div className="flex min-h-[118px] flex-col items-center justify-center gap-2 text-center">
          <Calendar className="h-5 w-5 text-[#9CA3AF]" />
          <p className="text-[12px] text-[#6B7280]">No attendance data for this period.</p>
        </div>
      ) : (
        <div className="flex gap-3">
          {/* Y Axis Numbers */}
          <div className="flex w-6 shrink-0 flex-col justify-between pb-6 text-right text-xs font-medium text-slate-500">
            {[...ticks].reverse().map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              preserveAspectRatio="none"
              className="h-[175px] w-full overflow-visible"
              role="img"
              aria-label="Daily attendance trend"
            >
              {/* Horizontal gridlines */}
              {ticks.map((tick) => {
                const y =
                  CHART_PADDING_TOP + USABLE_HEIGHT * (1 - tick / max);

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

              {/* Area gradient fill under present curve */}
              <path
                d={areaPath}
                fill="url(#attendance-area)"
                className="transition-all duration-700"
              />

              {/* Series polylines */}
              {SERIES_META.map((meta) => (
                <polyline
                  key={meta.key}
                  points={buildSeriesPoints(series, meta.key, max)}
                  fill="none"
                  stroke={meta.color}
                  strokeWidth={meta.key === "present" ? 2.5 : 1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {/* Data point dots on the Present line */}
              {series.map((point, index) => {
                const step =
                  series.length > 1 ? CHART_WIDTH / (series.length - 1) : CHART_WIDTH;
                const x = index * step;
                const ratio = max === 0 ? 0 : point.present / max;
                const y = CHART_PADDING_TOP + USABLE_HEIGHT * (1 - ratio);

                return (
                  <circle
                    key={point.day}
                    cx={x}
                    cy={y}
                    r={3.8}
                     fill="#2563EB"
                    stroke="#ffffff"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}

              <defs>
                <linearGradient
                  id="attendance-area"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                   <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
                   <stop offset="100%" stopColor="#2563EB" stopOpacity={0.01} />
                </linearGradient>
              </defs>
            </svg>

            {/* X Axis Date labels */}
            <div className="relative mt-2 h-4 text-[11px] font-medium text-slate-500">
              {xAxisIndices.map((index) => {
                const point = series[index];
                if (!point) return null;
                const percent =
                  (index / Math.max(series.length - 1, 1)) * 100;
                const alignClass =
                  index === 0
                    ? "translate-x-0"
                    : index === series.length - 1
                      ? "-translate-x-full"
                      : "-translate-x-1/2";

                return (
                  <span
                    key={point.day}
                    className={`absolute whitespace-nowrap ${alignClass}`}
                    style={{ left: `${percent}%` }}
                  >
                    {shortMonth} {point.day}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showComparison && summary && (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#F3F4F6] pt-3 sm:grid-cols-4">
          {[
            ["Present", summary.presentPercent, "text-[#047857]", "bg-[#ECFDF5]"],
            ["Late", summary.latePercent, "text-[#B45309]", "bg-[#FFFBEB]"],
            ["On Leave", summary.onLeavePercent, "text-[#2563EB]", "bg-[#EFF6FF]"],
            ["Absent", summary.absentPercent, "text-[#B91C1C]", "bg-[#FEF2F2]"],
          ].map(([label, value, text, background]) => (
            <div key={label} className={`rounded-md px-2.5 py-2 ${background}`}>
              <p className="text-[10px] text-[#6B7280]">{label}</p>
              <p className={`mt-0.5 text-[13px] font-semibold ${text}`}>
                {typeof value === "number" ? `${value}%` : "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
