import { useLayoutEffect, useRef, useState } from "react";
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

const PIXELS_PER_SECOND = 40;
const MINIMUM_DURATION_SECONDS = 6;

function getStatusStyle(status: string) {
  switch (status) {
    case "Approved":
      return {
        label: "Approved",
        className:
          "bg-green-400/20 text-green-200 ring-1 ring-green-300/30",
        icon: CheckCircle2,
      };

    case "Rejected":
      return {
        label: "Rejected",
        className:
          "bg-red-400/20 text-red-200 ring-1 ring-red-300/30",
        icon: XCircle,
      };

    case "Cancelled":
      return {
        label: "Cancelled",
        className:
          "bg-white/10 text-gray-200 ring-1 ring-white/20",
        icon: XCircle,
      };

    default:
      return {
        label: "Pending",
        className:
          "bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/30",
        icon: Clock3,
      };
  }
}

export default function EmployeeUpcomingLeaveTicker({
  leaves,
  loading = false,
  error = "",
}: EmployeeUpcomingLeaveTickerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);

  const [layout, setLayout] = useState({
    copies: 2,
    distance: 0,
    viewportWidth: 0,
  });

  const hasLeaves = leaves.length > 0;

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const itemsElement = itemsRef.current;

    if (!viewport || !itemsElement || !hasLeaves) {
      return;
    }

    const measure = () => {
      const contentWidth = itemsElement.getBoundingClientRect().width;

      if (contentWidth <= 0) return;

      const viewportWidth = viewport.clientWidth;

      const copies = Math.max(
        2,
        Math.ceil(viewportWidth / contentWidth) + 1,
      );

      setLayout((previous) =>
        previous.copies === copies &&
        previous.distance === contentWidth &&
        previous.viewportWidth === viewportWidth
          ? previous
          : {
              copies,
              distance: contentWidth,
              viewportWidth,
            },
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(itemsElement);

    return () => observer.disconnect();
  }, [leaves, hasLeaves]);

  const durationSeconds = Math.max(
    MINIMUM_DURATION_SECONDS,
    Math.round(layout.distance / PIXELS_PER_SECOND),
  );

  const renderLeave = (
    leave: UpcomingLeaveTickerItem,
    index: number,
  ) => {
    const status = getStatusStyle(leave.status);
    const StatusIcon = status.icon;

    return (
      <div
        key={`${leave.id}-${index}`}
        className="flex shrink-0 items-center gap-3 whitespace-nowrap px-6 py-3"
      >
        {/* Leave date */}
        <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-sky-400/30 to-indigo-400/30 shadow-lg ring-1 ring-white/20">
          <span className="text-base font-bold leading-5 text-white">
            {leave.day}
          </span>
          <span className="text-[10px] font-semibold uppercase text-blue-200">
            {leave.month}
          </span>
        </div>

        {/* Leave details */}
        <div className="min-w-[155px]">
          <p className="text-sm font-semibold text-white">
            {leave.leaveType}
          </p>
          <p className="mt-1 text-xs text-blue-200">
            {leave.weekday} · {leave.dates}
          </p>
        </div>

        {/* Leave status */}
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold ${status.className}`}
        >
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>

        <span className="mx-3 text-white/30">•</span>
      </div>
    );
  };

  return (
    <section
      className="relative mb-5 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#0d1b3d] via-[#1e3a8a] to-[#4331a5] shadow-xl shadow-blue-900/25"
      aria-label="Upcoming employee leaves"
    >
      {/* Animated background glow */}
      <div className="ticker-glow-1 pointer-events-none absolute -top-20 left-[15%] h-40 w-40 rounded-full bg-sky-400/30 blur-3xl" />

      <div className="ticker-glow-2 pointer-events-none absolute -bottom-24 right-[20%] h-44 w-44 rounded-full bg-fuchsia-400/25 blur-3xl" />

      {/* Moving shine effect */}
      <div className="ticker-shine pointer-events-none absolute inset-y-0 left-0 z-20 w-28 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative flex min-h-[76px] items-center">
        {/* Fixed heading */}
        <div className="relative z-10 flex min-h-[76px] min-w-[190px] items-center gap-3 border-r border-white/15 bg-white/5 px-5 backdrop-blur">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 text-xl shadow-lg shadow-orange-500/40 ring-2 ring-white/25">
            <CalendarDays className="h-5 w-5 text-white" />
          </span>

          <div>
            <h3 className="text-sm font-bold tracking-wide text-white">
              Upcoming Leaves
            </h3>
            <p className="text-xs text-blue-200/80">
              Your leave schedule
            </p>
          </div>
        </div>

        {/* Scrolling content */}
        <div
          ref={viewportRef}
          className="relative min-w-0 flex-1 overflow-hidden"
        >
          {loading ? (
            <p className="px-6 text-sm text-white/80">
              Loading upcoming leaves...
            </p>
          ) : error ? (
            <p className="px-6 text-sm text-red-200">
              {error}
            </p>
          ) : !hasLeaves ? (
            <div className="flex items-center gap-3 px-6">
              <Bell className="h-5 w-5 shrink-0 text-blue-200" />
              <p className="text-sm text-white/80">
                You don't have any upcoming leave records.
              </p>
            </div>
          ) : (
            <div
              className="employee-announcement-marquee flex w-max items-center"
              style={
                {
                  "--marquee-distance": `${layout.distance}px`,
                  "--marquee-duration": `${durationSeconds}s`,
                } as React.CSSProperties
              }
            >
              {Array.from(
                { length: layout.copies },
                (_, copyIndex) => (
                  <div
                    key={copyIndex}
                    className="flex shrink-0 items-center"
                    aria-hidden={copyIndex !== 0}
                  >
                    <div
                      ref={copyIndex === 0 ? itemsRef : undefined}
                      className="flex shrink-0 items-center"
                    >
                      {leaves.map((leave, index) =>
                        renderLeave(leave, index),
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}