import DashboardCard, { DashboardViewAllLink } from "./DashboardCard";
import { recruitmentStages } from "./dashboardData";
import { useAnimationFrame, useCountUp } from "./useDashboardAnimation";

function StageCounter({ value, delay }: { value: number; delay: number }) {
  const animated = useCountUp(value, 1000 + delay);

  return <>{Math.round(animated)}</>;
}

export default function RecruitmentFunnel() {
  const ready = useAnimationFrame();

  const topValue = Math.max(
    ...recruitmentStages.map((stage) => stage.value),
  );

  return (
    <DashboardCard
      title="Recruitment Pipeline"
      className="col-span-12 md:col-span-6 xl:col-span-2"
      action={<DashboardViewAllLink />}
    >
      <div className="space-y-2.5">
        {recruitmentStages.map((stage, index) => {
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

                <span className="text-[11px] font-semibold text-gray-800">
                  <StageCounter value={stage.value} delay={index * 110} />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}