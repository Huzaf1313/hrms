import React, { useEffect, useState, useMemo } from "react";
import { Building, Home, Clock } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { StatusPill } from "../../../components/ui/Badge";
import { useToast } from "../../../components/ui/useToast";
import { attendanceService, type MyAttendanceStatus } from "../attendanceService";
import { ApiError } from "../../../services/api";

export interface TodayPunchCardProps {
  shiftName?: string;
  shiftTiming?: string;
  gracePeriod?: number;
  onPunchSuccess?: (status: MyAttendanceStatus) => void;
  className?: string;
}

export const TodayPunchCard: React.FC<TodayPunchCardProps> = ({
  shiftName = "General Shift",
  shiftTiming = "09:30 AM - 06:30 PM",
  gracePeriod = 15,
  onPunchSuccess,
  className = "",
}) => {
  const { success, error } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [workLocation, setWorkLocation] = useState<"office" | "wfh">("office");
  const [myStatus, setMyStatus] = useState<MyAttendanceStatus | null>(null);
  const [isPunching, setIsPunching] = useState(false);

  // Initialize timer: derives from server check-in timestamp; localStorage only as fallback
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    const fallbackStr = localStorage.getItem("hrms_work_start_time");
    if (!fallbackStr) return 0;
    const startTime = parseInt(fallbackStr, 10);
    return isNaN(startTime) ? 0 : Math.max(0, Math.floor((Date.now() - startTime) / 1000));
  });

  // Live real-time clock updating every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch current self punch status on mount and derive work timer strictly from server
  useEffect(() => {
    let isMounted = true;
    attendanceService
      .myStatus()
      .then((status) => {
        if (!isMounted) return;
        setMyStatus(status);
        if (status.in_time && !status.out_time) {
          // Derive work timer directly from the server's check-in timestamp
          const inDate = new Date(status.in_time);
          const serverStartMs = !isNaN(inDate.getTime()) ? inDate.getTime() : Date.now();
          localStorage.setItem("hrms_work_start_time", String(serverStartMs));
          setElapsedSeconds(Math.max(0, Math.floor((Date.now() - serverStartMs) / 1000)));
        } else if (status.out_time) {
          localStorage.removeItem("hrms_work_start_time");
          setElapsedSeconds(0);
        }
      })
      .catch(() => {
        // Fallback: localStorage fallback is already initialized if present
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Work timer tick: derived from server check-in timestamp, falling back to localStorage
  useEffect(() => {
    if (myStatus?.out_time) {
      return;
    }

    const serverTimeMs = myStatus?.in_time ? new Date(myStatus.in_time).getTime() : NaN;
    const fallbackStr = localStorage.getItem("hrms_work_start_time");
    const fallbackMs = fallbackStr ? parseInt(fallbackStr, 10) : NaN;
    const baseTimeMs = !isNaN(serverTimeMs) ? serverTimeMs : (!isNaN(fallbackMs) ? fallbackMs : null);

    if (!baseTimeMs) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - baseTimeMs) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [myStatus]);

  const formattedClock = useMemo(() => {
    return currentTime.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }, [currentTime]);

  const formattedDate = useMemo(() => {
    return currentTime.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [currentTime]);

  const formattedWorkDuration = useMemo(() => {
    const hrs = Math.floor(elapsedSeconds / 3600);
    const mins = Math.floor((elapsedSeconds % 3600) / 60);
    const secs = elapsedSeconds % 60;
    return `${String(hrs).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
  }, [elapsedSeconds]);

  const punchState = useMemo(() => {
    if (!myStatus?.in_time) return "not_checked_in";
    if (myStatus.in_time && !myStatus.out_time) return "checked_in";
    return "checked_out";
  }, [myStatus]);

  async function handlePunch() {
    if (isPunching || punchState === "checked_out") return;

    setIsPunching(true);
    try {
      const result = await attendanceService.punchSelf();
      setMyStatus(result);

      if (!result.out_time) {
        // Checked In: derive start time directly from server timestamp
        const inDate = result.in_time ? new Date(result.in_time) : null;
        const startMs = inDate && !isNaN(inDate.getTime()) ? inDate.getTime() : Date.now();
        localStorage.setItem("hrms_work_start_time", String(startMs));
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
        success(`Checked in successfully at ${formattedClock}`, "Attendance Marked");
      } else {
        // Checked Out
        localStorage.removeItem("hrms_work_start_time");
        setElapsedSeconds(0);
        success(`Checked out successfully at ${formattedClock}`, "Shift Completed");
      }

      if (onPunchSuccess) {
        onPunchSuccess(result);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to record attendance punch.";
      error(msg, "Punch Failed");
    } finally {
      setIsPunching(false);
    }
  }

  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-none ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Left: Clock and Shift info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Live Workstation Time
            </span>
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <h2 className="text-2xl font-bold font-mono tracking-tight text-slate-900">
              {formattedClock}
            </h2>
            <span className="text-xs text-slate-500">{formattedDate}</span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {shiftName} ({shiftTiming})
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">Grace period: {gracePeriod} mins</span>
          </div>
        </div>

        {/* Right: Location & Action Button */}
        <div className="flex flex-col sm:items-end gap-3 min-w-[200px]">
          {/* Office vs WFH selector */}
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              disabled={punchState === "checked_in" || punchState === "checked_out"}
              onClick={() => setWorkLocation("office")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors ${
                workLocation === "office"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building className="w-3 h-3 text-slate-500" />
              Office
            </button>
            <button
              type="button"
              disabled={punchState === "checked_in" || punchState === "checked_out"}
              onClick={() => setWorkLocation("wfh")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors ${
                workLocation === "wfh"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Home className="w-3 h-3 text-slate-500" />
              WFH
            </button>
          </div>

          {/* Punch Button with Double-Click Protection */}
          {punchState === "not_checked_in" ? (
            <Button
              variant="primary"
              size="md"
              isLoading={isPunching}
              onClick={handlePunch}
              className="w-full sm:w-auto px-6 h-9"
              leftIcon={<Clock className="w-4 h-4" />}
            >
              Check In
            </Button>
          ) : punchState === "checked_in" ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="hidden sm:flex flex-col items-end mr-1">
                <span className="text-[11px] text-slate-400 uppercase font-medium">Logged Time</span>
                <span className="text-xs font-mono font-semibold text-emerald-700">
                  {formattedWorkDuration}
                </span>
              </div>
              <Button
                variant="danger"
                size="md"
                isLoading={isPunching}
                onClick={handlePunch}
                className="w-full sm:w-auto px-6 h-9"
                leftIcon={<Clock className="w-4 h-4" />}
              >
                Check Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <StatusPill variant="neutral" dot={false}>
                Completed for Today
              </StatusPill>
            </div>
          )}
        </div>
      </div>

      {/* Today's Punch Log Ribbon */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Status:</span>
            {punchState === "not_checked_in" ? (
              <StatusPill variant="warning">Not Checked In</StatusPill>
            ) : punchState === "checked_in" ? (
              <StatusPill variant="success">Working ({workLocation.toUpperCase()})</StatusPill>
            ) : (
              <StatusPill variant="neutral">Shift Completed</StatusPill>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">First In:</span>
            <span className="font-medium text-slate-800">
              {myStatus?.in_time ? myStatus.in_time : "--"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Last Out:</span>
            <span className="font-medium text-slate-800">
              {myStatus?.out_time ? myStatus.out_time : "--"}
            </span>
          </div>
        </div>

        {punchState === "checked_in" && (
          <div className="flex items-center gap-2 text-slate-600 font-medium sm:hidden">
            <span>Timer:</span>
            <span className="font-mono text-emerald-700 font-semibold">{formattedWorkDuration}</span>
          </div>
        )}
      </div>
    </div>
  );
};
