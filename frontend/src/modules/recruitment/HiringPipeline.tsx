import {
  PIPELINE_STAGES,
  STAGE_COLORS,
  STAGE_LABELS,
  type CandidateStage,
} from "./types";

interface HiringPipelineProps {
  pipeline?: Partial<Record<CandidateStage, number>> | {
    applied?: number;
    screening?: number;
    shortlisted?: number;
    interview?: number;
    selected?: number;
    offer?: number;
    hired?: number;
    screened?: number;
    offered?: number;
  };
}

function HiringPipeline({ pipeline = {} }: HiringPipelineProps) {
  // Support both legacy 4-stage keys and full 7-stage keys
  const getCount = (stage: CandidateStage): number => {
    const raw = pipeline as Record<string, number | undefined>;
    if (stage === "screening") return raw.screening ?? raw.screened ?? 0;
    if (stage === "offer") return raw.offer ?? raw.offered ?? 0;
    return raw[stage] ?? 0;
  };

  const stages = PIPELINE_STAGES.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    value: getCount(stage),
    color: STAGE_COLORS[stage],
  }));

  const maxValue = Math.max(...stages.map((stage) => stage.value), 1);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800">
          Recruitment Pipeline
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Candidate volume across all 7 progression stages
        </p>
      </div>

      <div className="space-y-4">
        {stages.map((item) => {
          const width = item.value === 0 ? 0 : (item.value / maxValue) * 100;

          return (
            <div key={item.stage}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-medium text-gray-700">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>

                <span className="font-semibold text-gray-800 tabular-nums">
                  {item.value}
                </span>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${width}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default HiringPipeline;
