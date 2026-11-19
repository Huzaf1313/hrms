import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";

import DashboardCard from "../dashboard/DashboardCard";

import { attendanceService } from "./attendanceService";
import { queryKeys } from "../../lib/queryKeys";

const CHART_WIDTH = 620;
const CHART_HEIGHT = 190;
const CHART_PADDING_TOP = 10;
const CHART_PADDING_BOTTOM = 8;

const SERIES_META = [
  { key: "present", label: "Present", color: "#16a34a" },
  { key: "late", label: "Late", color: "#f97316" },
  { key: "absent", label: "Absent", color: "#ef4444" },
  { key: "onLeave", label: "On Leave", color: "#a855f7" },
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

/** First and last day of the month, as "YYYY-MM-DD". */
function monthBounds(key: string): { start: string; end: string } {
  const [year, month] = key.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

/** The last twelve months, so the picker always has something to pick. */
const MONTH_OPTIONS: { key: string; label: string }[] = (() => {
  const options: { key: string; label: string }[] = [];
  const now = new Date();

  for (let back = 11; back >= 0; back -= 1) {
    const key = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - back, 1));

    options.push({ key, label: monthLabelOf(key) });
  }

  return options;
})();

/**
 * Rounds the axis top up to a readable number that splits evenly into four
 * gridlines, so the labels stay whole numbers whatever the headcount is.
 */
const AXIS_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function buildAxis(peak: number): { max: number; ticks: number[] } {
  if (peak <= 0) {
    return { max: 4, ticks: [0, 1, 2, 3, 4] };
  }

  const magnitude = Math.pow(10, Math.floor(Math.log10(peak)));
  const normalized = peak / magnitude;

  const factor = AXIS_STEPS.find((step) => step >= normalized) ?? 10;

  // Rounded up to a multiple of four so the four gridlines land on whole
  // numbers.
  const max = Math.ceil((factor * magnitude) / 4) * 4;

  return { max, ticks: [0, max / 4, max / 2, (max * 3) / 4, max] };
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

export default function AttendanceTrendChart() {
  const [month, setMonth] = useState(() => monthKeyOf(new Date()));

  const bounds = useMemo(() => monthBounds(month), [month]);

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.admin.attendanceTrend(bounds.start, bounds.end),
    queryFn: () =>
      attendanceService.trend({
        start_date: bounds.start,
        end_date: bounds.end,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const series = useMemo<TrendPoint[]>(
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

  const shortMonth = monthLabelOf(month).split(" ")[0]?.slice(0, 3) ?? "";

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
            {MONTH_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>

          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
        </label>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {SERIES_META.map((meta) => (
          <span
            key={meta.key}
            className="dashboard-fade-in flex items-center gap-1.5 text-[11px] text-gray-600"
            style={{ animationDelay: "900ms" }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: meta.color }}
            />
            {meta.label}
          </span>
        ))}
      </div>

      {isPending ? (
        <div className="flex h-[168px] items-center justify-center text-[11px] text-gray-400">
          Loading attendance…
        </div>
      ) : isError ? (
        <div className="flex h-[168px] items-center justify-center text-[11px] text-rose-500">
          Could not load attendance for this month.
        </div>
      ) : series.length === 0 ? (
        <div className="flex h-[168px] items-center justify-center text-[11px] text-gray-400">
          No attendance data for this month.
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <div className="flex w-7 shrink-0 flex-col justify-between pb-1 text-right text-[10px] font-medium text-gray-600">
              {[...ticks].reverse().map((tick) => (
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
                      stroke="#cbd5e1"
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

                {SERIES_META.map((meta, index) => (
                  <polyline
                    key={meta.key}
                    points={buildSeriesPoints(series, meta.key, max)}
                    pathLength={1}
                    fill="none"
                    stroke={meta.color}
                    strokeWidth={meta.key === "present" ? 2.4 : 1.6}
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
              <div className="relative mt-1 h-3 px-3 text-[10px] font-medium text-gray-600">
                {series
                  .map((point, index) => ({ point, index }))
                  .filter(({ point }) => point.day % 5 === 0 || point.day === 1)
                  .map(({ point, index }) => {
                    const percent =
                      ((index) / Math.max(series.length - 1, 1)) * 100;

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
        </>
      )}
    </DashboardCard>
  );
}
