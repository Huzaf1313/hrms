import React from "react";
import { UserCheck, UserX, Clock, CalendarDays, Timer } from "lucide-react";
import { StatCard } from "../../../components/ui/StatCard";

export interface AttendanceStatRowProps {
  presentCount: number;
  absentCount: number;
  lateCount: number;
  onLeaveCount: number;
  avgHours?: string;
  totalEmployees?: number;
  isPersonal?: boolean;
  className?: string;
}

export const AttendanceStatRow: React.FC<AttendanceStatRowProps> = ({
  presentCount,
  absentCount,
  lateCount,
  onLeaveCount,
  avgHours = "8h 24m",
  totalEmployees,
  isPersonal = false,
  className = "",
}) => {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 ${className}`}>
      {/* Present: green dot */}
      <StatCard
        label={isPersonal ? "Days Present" : "Present Today"}
        value={presentCount}
        subtext={totalEmployees ? `${Math.round((presentCount / totalEmployees) * 100)}% of total` : undefined}
        dotColor="bg-emerald-500"
        icon={<UserCheck className="w-4 h-4 text-slate-400" />}
      />

      {/* Late: amber dot */}
      <StatCard
        label={isPersonal ? "Days Late" : "Late Today"}
        value={lateCount}
        subtext={totalEmployees ? `${Math.round((lateCount / totalEmployees) * 100)}% late` : undefined}
        dotColor="bg-amber-500"
        icon={<Clock className="w-4 h-4 text-slate-400" />}
      />

      {/* On Leave: blue dot */}
      <StatCard
        label={isPersonal ? "Days On Leave" : "On Leave Today"}
        value={onLeaveCount}
        subtext={totalEmployees ? `${Math.round((onLeaveCount / totalEmployees) * 100)}% on leave` : undefined}
        dotColor="bg-blue-500"
        icon={<CalendarDays className="w-4 h-4 text-slate-400" />}
      />

      {/* Absent: red dot */}
      <StatCard
        label={isPersonal ? "Days Absent" : "Absent Today"}
        value={absentCount}
        subtext={totalEmployees ? `${Math.round((absentCount / totalEmployees) * 100)}% absent` : undefined}
        dotColor="bg-rose-500"
        icon={<UserX className="w-4 h-4 text-slate-400" />}
      />

      {/* Avg Hours: slate dot */}
      <StatCard
        label={isPersonal ? "Avg. Daily Hours" : "Avg. Working Hours"}
        value={avgHours}
        subtext="Standard 8.0h shift"
        dotColor="bg-slate-400"
        icon={<Timer className="w-4 h-4 text-slate-400" />}
      />
    </div>
  );
};
