interface HiringPipelineData {
  applied: number;
  screened: number;
  interview: number;
  offered: number;
}

interface HiringPipelineProps {
  pipeline: HiringPipelineData;
}

function HiringPipeline({ pipeline }: HiringPipelineProps) {
  const stages = [
    {
      label: "Applied",
      value: pipeline.applied,
    },
    {
      label: "Screened",
      value: pipeline.screened,
    },
    {
      label: "Interview",
      value: pipeline.interview,
    },
    {
      label: "Offered",
      value: pipeline.offered,
    },
  ];

  const maxValue = Math.max(
    ...stages.map((stage) => stage.value),
    1,
  );

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          Hiring Pipeline
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Current recruitment progress
        </p>
      </div>

      <div className="space-y-5">
        {stages.map((stage) => {
          const width =
            stage.value === 0
              ? 0
              : (stage.value / maxValue) * 100;

          return (
            <div key={stage.label}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {stage.label}
                </span>

                <span className="text-sm font-semibold text-gray-800">
                  {stage.value}
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-[#2563eb]"
                  style={{
                    width: `${width}%`,
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
