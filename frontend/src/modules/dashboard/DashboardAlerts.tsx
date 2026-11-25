import { AlertTriangle, CalendarDays, CheckCircle2, Clock, ChevronRight } from "lucide-react";

import type { DashboardMetrics } from "./useDashboardMetrics";

interface DashboardAlertsProps {
  metrics: DashboardMetrics;
  onNavigate: (page: string) => void;
}

interface AlertItem {
  id: string;
  label: string;
  detail: string;
  tone: "danger" | "warning" | "info" | "success";
  icon: typeof AlertTriangle;
  page: string;
}

const toneStyles = {
  danger: {
    wrapper: "border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2]",
    icon: "bg-white text-[#B91C1C]",
    text: "text-[#991B1B]",
  },
  warning: {
    wrapper: "border-[#FDE68A] bg-[#FFFBEB] hover:bg-[#FEF3C7]",
    icon: "bg-white text-[#B45309]",
    text: "text-[#92400E]",
  },
  info: {
    wrapper: "border-[#BFDBFE] bg-[#EFF6FF] hover:bg-[#DBEAFE]",
    icon: "bg-white text-[#2563EB]",
    text: "text-[#1E40AF]",
  },
  success: {
    wrapper: "border-[#BBF7D0] bg-[#F0FDF4] hover:bg-[#DCFCE7]",
    icon: "bg-white text-[#15803D]",
    text: "text-[#166534]",
  },
} as const;

export default function DashboardAlerts({
  metrics,
  onNavigate,
}: DashboardAlertsProps) {
  const absent = metrics.absentToday ?? 0;
  const late = metrics.lateToday ?? 0;
  const pendingLeave = metrics.pendingLeaveRequests ?? 0;

  const alerts: AlertItem[] = [
    {
      id: "absent",
      label: absent > 0 ? `${absent} employees absent today` : "No absences reported",
      detail: absent > 0 ? "Review attendance" : "Attendance is clear",
      tone: absent > 0 ? "danger" : "success",
      icon: absent > 0 ? AlertTriangle : CheckCircle2,
      page: "Attendance",
    },
    {
      id: "late",
      label: late > 0 ? `${late} late arrival${late === 1 ? "" : "s"}` : "No late arrivals",
      detail: late > 0 ? "Review today's roster" : "Everyone is on time",
      tone: late > 0 ? "warning" : "success",
      icon: Clock,
      page: "Attendance",
    },
    {
      id: "leave",
      label:
        pendingLeave > 0
          ? `${pendingLeave} pending leave request${pendingLeave === 1 ? "" : "s"}`
          : "No pending leave requests",
      detail: pendingLeave > 0 ? "Needs your review" : "Leave queue is clear",
      tone: pendingLeave > 0 ? "info" : "success",
      icon: CalendarDays,
      page: "Leave",
    },
  ];

  return (
    <section aria-labelledby="dashboard-alerts-title">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="dashboard-alerts-title" className="text-[13px] font-semibold text-[#111827]">
          Today&apos;s priorities
        </h2>
        <span className="text-[11px] text-[#6B7280]">Quick overview</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {alerts.map((alert) => {
          const Icon = alert.icon;
          const styles = toneStyles[alert.tone];

          return (
            <button
              key={alert.id}
              type="button"
              onClick={() => onNavigate(alert.page)}
              className={`flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1 ${styles.wrapper}`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${styles.icon}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[12px] font-semibold ${styles.text}`}>
                  {alert.label}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-[#6B7280]">
                  {alert.detail}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
