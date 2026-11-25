import type { CSSProperties } from "react";
import { CalendarDays, Video } from "lucide-react";

import type { UpcomingInterview } from "./types";
import DashboardCard, { DashboardViewAllLink } from "../dashboard/DashboardCard";
import { initialsFor } from "../dashboard/dashboardData";
import type { DashboardMetrics } from "../dashboard/useDashboardMetrics";

/** "20 Oct" or "20 Oct 2026" when the interview is not in the current year. */
function dateLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  const sameYear = date.getFullYear() === new Date().getFullYear();

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function timeLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Today or the weekday, so the list reads as a schedule rather than dates. */
function relativeDay(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const days = Math.round(
    (date.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86_400_000,
  );

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";

  return date.toLocaleDateString("en-GB", { weekday: "short" });
}

interface UpcomingInterviewsCardProps {
  metrics: DashboardMetrics;
  onOpenRecruitment: () => void;
}

/**
 * Interviews booked from the recruitment pipeline.
 *
 * Reads the same scheduled slots the recruitment page writes, so booking or
 * cancelling an interview there shows up here on the next refresh.
 */
export default function UpcomingInterviewsCard({
  metrics,
  onOpenRecruitment,
}: UpcomingInterviewsCardProps) {
  const interviews: UpcomingInterview[] = metrics.upcomingInterviews ?? [];

  return (
    <DashboardCard
      title="Upcoming Interviews"
      className="col-span-12 md:col-span-6 lg:col-span-3"
      action={<DashboardViewAllLink onClick={onOpenRecruitment} />}
    >
      {interviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
          <CalendarDays className="h-4 w-4 text-gray-300" />
          <p className="text-[11px] text-gray-400">No interviews scheduled.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {interviews.map((interview, index) => {
            const relative = relativeDay(interview.interview_scheduled_at);

            return (
              <div
                key={interview.id}
                className="dashboard-rise flex items-center gap-2.5 rounded-xl border border-gray-50 px-2 py-2 transition hover:border-[#dbeafe] hover:bg-[#eff6ff]"
                style={
                  { "--dashboard-delay": `${index * 90}ms` } as CSSProperties
                }
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d1fae5] text-[10px] font-bold text-[#047857]">
                  {initialsFor(interview.full_name)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-gray-700">
                    {interview.full_name}
                  </p>
                  <p className="truncate text-[10px] text-gray-400">
                    {interview.job_title}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-medium text-gray-600">
                    {relative || dateLabel(interview.interview_scheduled_at)}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {timeLabel(interview.interview_scheduled_at)}
                  </p>
                </div>

                <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#eff6ff] px-2 py-0.5 text-[9px] font-semibold text-[#2563eb]">
                  <Video className="h-2.5 w-2.5" />
                  Scheduled
                </span>
              </div>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
