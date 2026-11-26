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
    <div className={`rounded-[8px] border border-[#E4E6E1] bg-white p-[20px] shadow-none ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        {/* Left: Clock and Shift info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-[#7B8794]">
              Workstation Live Time
            </span>
            <span className="inline-block h-2 w-2 rounded-full bg-[#1E6B45] animate-pulse" />
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <h2 className="text-[24px] font-semibold font-mono tracking-tight text-[#1F2933]">
              {formattedClock}
            </h2>
            <span className="text-[12px] text-[#7B8794]">{formattedDate}</span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[12px] text-[#52606D]">
            <span className="flex items-center gap-1.5 font-medium text-[#1F2933]">
              <Clock className="w-3.5 h-3.5 text-[#7B8794]" />
              {shiftName} ({shiftTiming})
            </span>
            <span className="text-[#E4E6E1]">•</span>
            <span className="text-[#7B8794]">Grace: {gracePeriod}m</span>
          </div>
        </div>

        {/* Right: Location & Action Button */}
        <div className="flex flex-col sm:items-end gap-3 min-w-[200px]">
          {/* Office vs WFH selector */}
          <div className="inline-flex rounded-[6px] bg-[#F0F1EE] p-0.5 text-[12px]">
            <button
              type="button"
              disabled={punchState === "checked_in" || punchState === "checked_out"}
              onClick={() => setWorkLocation("office")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px] font-medium transition-colors ${
                workLocation === "office"
                  ? "bg-white text-[#1F2933] border border-[#E4E6E1]"
                  : "text-[#52606D] hover:text-[#1F2933]"
              }`}
            >
              <Building className="w-3 h-3 text-[#7B8794]" />
              Office
            </button>
            <button
              type="button"
              disabled={punchState === "checked_in" || punchState === "checked_out"}
              onClick={() => setWorkLocation("wfh")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[5px] font-medium transition-colors ${
                workLocation === "wfh"
                  ? "bg-white text-[#1F2933] border border-[#E4E6E1]"
                  : "text-[#52606D] hover:text-[#1F2933]"
              }`}
            >
              <Home className="w-3 h-3 text-[#7B8794]" />
              WFH
            </button>
          </div>

          {/* Punch Button with Double-Click Protection (40px high) */}
          {punchState === "not_checked_in" ? (
            <Button
              variant="primary"
              size="md"
              isLoading={isPunching}
              onClick={handlePunch}
              className="w-full sm:w-auto px-6 h-[40px] text-[13.5px] font-medium"
              leftIcon={<Clock className="w-4 h-4" />}
            >
              Punch In
            </Button>
          ) : punchState === "checked_in" ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="hidden sm:flex flex-col items-end mr-1">
                <span className="text-xs text-[#7B8794] uppercase font-medium">Logged Time</span>
                <span className="text-xs font-mono font-semibold text-[#1E6B45]">
                  {formattedWorkDuration}
                </span>
              </div>
              <Button
                variant="danger"
                size="md"
                isLoading={isPunching}
                onClick={handlePunch}
                className="w-full sm:w-auto px-6 h-[40px] text-sm font-medium"
                leftIcon={<Clock className="w-4 h-4" />}
              >
                Punch Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <StatusPill variant="off" dot={false}>
                Completed for Today
              </StatusPill>
            </div>
          )}
        </div>
      </div>

      {/* Today's Punch Log Ribbon */}
      <div className="mt-4 pt-3.5 border-t border-[#E4E6E1] flex flex-wrap items-center justify-between gap-3 text-[12px]">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[#7B8794]">Status:</span>
            {punchState === "not_checked_in" ? (
              <StatusPill variant="warn">Not Checked In</StatusPill>
            ) : punchState === "checked_in" ? (
              <StatusPill variant="ok">Working ({workLocation.toUpperCase()})</StatusPill>
            ) : (
              <StatusPill variant="off">Shift Completed</StatusPill>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#7B8794]">First In:</span>
            <span className="font-medium text-[#1F2933]">
              {myStatus?.in_time ? myStatus.in_time : "-"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#7B8794]">Last Out:</span>
            <span className="font-medium text-[#1F2933]">
              {myStatus?.out_time ? myStatus.out_time : "-"}
            </span>
          </div>
        </div>

        {punchState === "checked_in" && (
          <div className="flex items-center gap-2 text-[#52606D] font-medium sm:hidden">
            <span>Timer:</span>
            <span className="font-mono text-[#1E6B45] font-semibold">{formattedWorkDuration}</span>
          </div>
        )}
      </div>
    </div>
  );
};
