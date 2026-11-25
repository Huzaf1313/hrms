import { EXIT_TYPES, EXIT_TYPE_META } from "./types";
import { PANEL_CLASS, percent } from "./exitUiUtils";

const DONUT_RADIUS = 52;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const DONUT_STROKE_WIDTH = 18;

interface ExitTypeDonutProps {
  byType: Record<string, number>;
  total: number;
}

/**
 * Exit type mix.
 *
 * Every type is drawn, including zero-count ones, so the legend stays the same
 * rows and colours do not shuffle when a type goes unused.
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
    <div className={PANEL_CLASS}>
      <div className="border-b border-[#E5E7EB] bg-white px-5 py-3.5">
        <h3 className="text-[13px] font-semibold text-[#111827]">Exit Requests by Type</h3>
      </div>

      <div className="flex items-center gap-4 p-5">
        <svg
          viewBox="0 0 140 140"
          className="h-[104px] w-[104px] shrink-0"
          role="img"
          aria-label={`Exit requests by type, ${total} total`}
        >
          <g transform="translate(70, 70) rotate(-90)">
            <circle
              r={DONUT_RADIUS}
              fill="none"
              stroke="#E5E7EB"
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

          <text x="70" y="68" textAnchor="middle" className="fill-[#111827] text-[22px] font-semibold tabular-nums">
            {total}
          </text>
          <text x="70" y="86" textAnchor="middle" className="fill-[#6B7280] text-[11px] font-medium">
            Total
          </text>
        </svg>

        <ul className="min-w-0 flex-1 space-y-2.5">
          {segments.map((segment) => (
            <li key={segment.type} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: EXIT_TYPE_META[segment.type].color }}
                />
                <span className="whitespace-nowrap text-[#4B5563]">
                  {segment.type}
                </span>
              </span>
              <span className="flex items-center gap-1.5 shrink-0 tabular-nums">
                <span className="font-semibold text-[#111827]">{segment.count}</span>
                <span className="w-[42px] text-right text-[#6B7280]">
                  ({percent(segment.count, total)})
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}