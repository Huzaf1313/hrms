
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Clock3,
  CheckCircle2,
  XCircle,
  Bell,
} from "lucide-react";

export interface UpcomingLeaveTickerItem {
  id: string;
  day: string;
  month: string;
  weekday: string;
  leaveType: string;
  dates: string;
  status: "Pending" | "Approved" | "Rejected" | "Cancelled";
}

interface EmployeeUpcomingLeaveTickerProps {
  leaves: UpcomingLeaveTickerItem[];
  loading?: boolean;
  error?: string;
}

function getStatusStyle(status: string) {
  switch (status) {
    case "Approved":
      return {
        label: "Approved",
        className: "bg-green-50 text-green-700 border-green-200",
        icon: CheckCircle2,
      };

    case "Rejected":
      return {
        label: "Rejected",
        className: "bg-red-50 text-red-700 border-red-200",
        icon: XCircle,
      };

    case "Cancelled":
      return {
        label: "Cancelled",
        className: "bg-gray-100 text-gray-600 border-gray-200",
        icon: XCircle,
      };

    default:
      return {
        label: "Pending",
        className: "bg-amber-50 text-amber-700 border-amber-200",
        icon: Clock3,
      };
  }
}

export default function EmployeeUpcomingLeaveTicker({
  leaves,
  loading = false,
  error = "",
}: EmployeeUpcomingLeaveTickerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(30);

  useEffect(() => {
    const track = trackRef.current;

    if (!track || leaves.length === 0) return;

    const updateDuration = () => {
      const halfWidth = track.scrollWidth / 2;

      // Approximately 40 pixels per second.
      setDuration(Math.max(12, halfWidth / 40));
    };

    updateDuration();

    const observer = new ResizeObserver(updateDuration);
    observer.observe(track);

    return () => observer.disconnect();
  }, [leaves]);

  if (loading) {
    return (
      <div className="mb-5 flex h-[76px] items-center gap-4 overflow-hidden rounded-2xl border border-blue-100 bg-white px-5 shadow-sm">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-blue-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-40 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-64 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-5 flex min-h-[76px] items-center gap-3 rounded-2xl border border-red-100 bg-white px-5 shadow-sm">
        <Bell className="h-5 w-5 shrink-0 text-red-500" />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (leaves.length === 0) {
    return (
      <div className="mb-5 flex min-h-[76px] items-center gap-4 rounded-2xl border border-gray-100 bg-white px-5 shadow-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
          <CalendarDays className="h-5 w-5 text-blue-600" />
        </div>

        <div>
          <p className="text-sm font-bold text-slate-800">
            Upcoming Leave Notifications
          </p>
          <p className="mt-1 text-xs text-slate-500">
            You don't have any upcoming leave records.
          </p>
        </div>
      </div>
    );
  }

  const renderLeave = (leave: UpcomingLeaveTickerItem, index: number) => {
    const status = getStatusStyle(leave.status);
    const StatusIcon = status.icon;

    return (
      <div
        key={`${leave.id}-${index}`}
        className="mx-3 flex shrink-0 items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
      >
        <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50">
          <span className="text-base font-bold leading-5 text-blue-700">
            {leave.day}
          </span>
          <span className="text-[10px] font-semibold uppercase text-blue-500">
            {leave.month}
          </span>
        </div>

        <div className="min-w-[155px]">
          <p className="text-sm font-semibold text-slate-800">
            {leave.leaveType}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {leave.weekday} · {leave.dates}
          </p>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${status.className}`}
        >
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>
      </div>
    );
  };

  return (
    <div className="mb-5 flex min-h-[88px] w-full overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50 shadow-sm">
      {/* Fixed heading */}
      <div className="relative z-10 flex w-[210px] shrink-0 items-center gap-3 border-r border-blue-100 bg-white/90 px-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100">
          <Bell className="h-5 w-5 text-blue-600" />
        </div>

        <div>
          <p className="text-sm font-bold text-slate-800">
            Upcoming Leaves
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Your leave schedule
          </p>
        </div>
      </div>

      {/* Scrolling content */}
      <div className="relative flex min-w-0 flex-1 items-center overflow-hidden">
        <div
          ref={trackRef}
          className="employee-leave-marquee flex w-max items-center py-2"
          style={{
            animationDuration: `${duration}s`,
          }}
        >
          <div className="flex shrink-0 items-center">
            {leaves.map((leave, index) =>
              renderLeave(leave, index),
            )}
          </div>

          {/* Duplicate content for seamless scrolling */}
          <div
            className="flex shrink-0 items-center"
            aria-hidden="true"
          >
            {leaves.map((leave, index) =>
              renderLeave(leave, index + leaves.length),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}