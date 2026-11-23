import React from "react";
import { UserCheck, Clock, CalendarDays, UserX, Timer } from "lucide-react";

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

interface StatItemWithIcon {
  label: string;
  value: string | number;
  helper?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
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
  const items: StatItemWithIcon[] = [
    {
      label: isPersonal ? "Days Present" : "Present",
      value: presentCount,
      helper: totalEmployees ? `${Math.round((presentCount / totalEmployees) * 100)}% on time` : "On time punches",
      icon: UserCheck,
      iconBg: "bg-[#E3F5E1]",
      iconColor: "text-[#1E6B45]",
    },
    {
      label: isPersonal ? "Days Late" : "Late",
      value: lateCount,
      helper: totalEmployees ? `${Math.round((lateCount / totalEmployees) * 100)}% late arrivals` : "Grace period exceeded",
      icon: Clock,
      iconBg: "bg-[#FDF3D6]",
      iconColor: "text-[#8A5A00]",
    },
    {
      label: isPersonal ? "Days On Leave" : "On Leave",
      value: onLeaveCount,
      helper: totalEmployees ? `${Math.round((onLeaveCount / totalEmployees) * 100)}% approved leaves` : "Approved leaves",
      icon: CalendarDays,
      iconBg: "bg-[#E8EEFB]",
      iconColor: "text-[#2F5FD0]",
    },
    {
      label: isPersonal ? "Days Absent" : "Absent",
      value: absentCount,
      helper: totalEmployees ? `${Math.round((absentCount / totalEmployees) * 100)}% unexcused` : "Unexcused absences",
      icon: UserX,
      iconBg: "bg-[#FBE4E1]",
      iconColor: "text-[#A12D22]",
    },
    {
      label: isPersonal ? "Avg. Daily Hours" : "Avg. Hours",
      value: avgHours,
      helper: "Standard 8.0h shift",
      icon: Timer,
      iconBg: "bg-[#F0F1EE]",
      iconColor: "text-[#52606D]",
    },
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 ${className}`}>
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className="rounded-lg border border-[#E4E6E1] bg-white p-[16px_20px] min-h-[96px] shadow-none flex flex-col justify-between min-w-0"
          >
            {/* Top row: Label on left, Icon badge on right */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[13px] font-medium text-[#7B8794] truncate">
                {item.label}
              </span>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.iconBg}`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${item.iconColor}`} />
              </div>
            </div>

            {/* Big number: label to big number 8px (mt-2), line-height tight (1.1) */}
            <div className="mt-2">
              <span className="text-[28px] font-semibold text-[#1F2933] tracking-tight leading-[1.1] block">
                {item.value}
              </span>
            </div>

            {/* Subtext: number to subtext 4px (mt-1), muted color, no extra margin (m-0) */}
            {item.helper && (
              <span className="text-xs text-[#7B8794] mt-1 truncate block m-0">
                {item.helper}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
