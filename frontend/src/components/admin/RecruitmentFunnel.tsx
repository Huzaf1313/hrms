import {
  PIPELINE_STAGES,
  STAGE_COLORS,
  STAGE_LABELS,
} from "../../types/recruitment";
import DashboardCard, { DashboardViewAllLink } from "./DashboardCard";
import { recruitmentStages } from "./dashboardData";
import { useAnimationFrame, useCountUp } from "./useDashboardAnimation";
import type { DashboardMetrics } from "./useDashboardMetrics";

function StageCounter({ value, delay }: { value: number; delay: number }) {
  const animated = useCountUp(value, 1000 + delay);

  return <>{Math.round(animated)}</>;
}

interface RecruitmentFunnelProps {
  metrics: DashboardMetrics;
  onOpenRecruitment: () => void;
}

/**
 * Candidate counts per pipeline stage.
 *
 * Reads the same stage counts the recruitment board is built from, so moving a
 * candidate between columns on that page is reflected here. The hardcoded rows
 * in `dashboardData` stand in until the stats call resolves or if it fails.
 */
export default function RecruitmentFunnel({
  metrics,
  onOpenRecruitment,
}: RecruitmentFunnelProps) {
  const ready = useAnimationFrame();

  const counts = metrics.recruitmentStageCounts;

  const stages = PIPELINE_STAGES.map((stage) => ({
    label: STAGE_LABELS[stage],
    value: counts ? (counts[stage] ?? 0) : null,
    color: STAGE_COLORS[stage],
  }));

  const placeholders = recruitmentStages;

  // Without live counts the rows fall back to the placeholder sequence, matched
  // by position because both lists walk the same seven stages.
  const rows = stages.map((stage, index) => ({
    ...stage,
    value: stage.value ?? placeholders[index]?.value ?? 0,
  }));

  const total = rows.reduce((sum, stage) => sum + stage.value, 0);

  // Normalising against the largest stage keeps the bars readable whether the
  // pipeline holds ten candidates or ten thousand.
  const topValue = Math.max(...rows.map((stage) => stage.value), 1);

  return (
    <DashboardCard
      title="Recruitment Pipeline"
      className="col-span-12 md:col-span-6 xl:col-span-4"
      action={<DashboardViewAllLink onClick={onOpenRecruitment} />}
    >
      <div className="space-y-2.5">
        {rows.map((stage, index) => {
          const percent = (stage.value / topValue) * 100;

          return (
            <div key={stage.label} className="flex items-center gap-2">
              <div className="h-4 w-[38%] shrink-0 overflow-hidden rounded-sm bg-gray-50">
                <div
                  className="h-full rounded-sm transition-[width] duration-1000 ease-out"
                  style={{
                    width: ready ? `${percent}%` : "0%",
                    backgroundColor: stage.color,
                    transitionDelay: `${index * 110}ms`,
                  }}
                />
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />

                <span className="min-w-0 flex-1 truncate text-[11px] text-gray-600">
                  {stage.label}
                </span>

                <span className="text-[11px] font-semibold text-gray-800 tabular-nums">
                  <StageCounter value={stage.value} delay={index * 110} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Only meaningful once the live counts have landed. */}
      {counts && (
        <p className="mt-3 border-t border-gray-100 pt-2.5 text-[11px] text-gray-400">
          {total} candidate{total === 1 ? "" : "s"} across the pipeline
        </p>
      )}
    </DashboardCard>
  );
}