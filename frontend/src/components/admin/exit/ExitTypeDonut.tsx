import { EXIT_TYPES, EXIT_TYPE_META } from "../../../types/exitRequest";
import { percent } from "./exitUiUtils";

const DONUT_RADIUS = 54;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const DONUT_STROKE_WIDTH = 20;

interface ExitTypeDonutProps {
  byType: Record<string, number>;
  total: number;
}

/**
 * Exit type mix.
 *
 * Every type is drawn, including zero-count ones, so the legend stays the same
 * four rows the KPI cards above show and the colours do not shuffle when a type
 * goes unused.
 */
export default function ExitTypeDonut({ byType, total }: ExitTypeDonutProps) {
  const counts = EXIT_TYPES.map((type) => byType[type] ?? 0);

  const segments = EXIT_TYPES.map((type, index) => {
    const count = counts[index];
    const dash = total ? (count / total) * DONUT_CIRCUMFERENCE : 0;
    const offset = counts
      .slice(0, index)
      .reduce(
        (sum, previous) =>
          sum + (total ? (previous / total) * DONUT_CIRCUMFERENCE : 0),
        0,
      );

    return { type, count, dash, offset };
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-[15px] font-bold text-slate-900">Exit Requests by Type</h3>

      <div className="flex items-center gap-5">
        <svg
          viewBox="0 0 140 140"
          className="h-[124px] w-[124px] shrink-0"
          role="img"
          aria-label={`Exit requests by type, ${total} total`}
        >
          <g transform="translate(70, 70) rotate(-90)">
            <circle
              r={DONUT_RADIUS}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth={DONUT_STROKE_WIDTH}
            />

            {segments.map((segment) =>
              segment.count > 0 ? (
                <circle
                  key={segment.type}
                  r={DONUT_RADIUS}
                  fill="none"
                  stroke={EXIT_TYPE_META[segment.type].color}
                  strokeWidth={DONUT_STROKE_WIDTH}
                  strokeDasharray={`${segment.dash} ${DONUT_CIRCUMFERENCE - segment.dash}`}
                  strokeDashoffset={-segment.offset}
                />
              ) : null,
            )}
          </g>

          <text x="70" y="68" textAnchor="middle" className="fill-slate-900 text-[22px] font-bold">
            {total}
          </text>
          <text x="70" y="85" textAnchor="middle" className="fill-slate-400 text-[9px]">
            Total
          </text>
        </svg>

        <ul className="min-w-0 flex-1 space-y-2.5">
          {segments.map((segment) => (
            <li key={segment.type} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: EXIT_TYPE_META[segment.type].color }}
              />
              <span className="min-w-0 flex-1 truncate text-slate-600">
                {segment.type}
              </span>
              <span className="shrink-0 font-semibold text-slate-900">{segment.count}</span>
              <span className="w-11 shrink-0 text-right text-slate-400">
                ({percent(segment.count, total)})
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}