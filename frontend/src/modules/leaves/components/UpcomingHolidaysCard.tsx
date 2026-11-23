import React from "react";
import { Sparkles, Calendar } from "lucide-react";
import type { MockHoliday } from "../../../services/mock/leaveMockService";

export interface UpcomingHolidaysCardProps {
  holidays: MockHoliday[];
  className?: string;
}

export const UpcomingHolidaysCard: React.FC<UpcomingHolidaysCardProps> = ({
  holidays,
  className = "",
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const futureHolidays = holidays.filter((h) => h.date >= todayStr).slice(0, 4);

  return (
    <div className={`rounded-[8px] bg-white border border-[#E4E6E1] p-[16px_20px] shadow-none flex flex-col justify-between ${className}`}>
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#E4E6E1]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#C2410C]" />
            <h3 className="text-[14px] font-semibold text-[#1F2933]">Upcoming Holidays</h3>
          </div>
          <span className="text-[12px] text-[#7B8794]">2026 Calendar</span>
        </div>

        <div className="mt-3 divide-y divide-[#E4E6E1]">
          {futureHolidays.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-[#7B8794]">
              No upcoming company holidays remaining this year.
            </div>
          ) : (
            futureHolidays.map((holiday) => {
              const diffMs = new Date(holiday.date).getTime() - new Date(todayStr).getTime();
              const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

              return (
                <div key={holiday.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[13.5px] font-medium text-[#1F2933] block truncate">
                      {holiday.name}
                    </span>
                    <span className="text-xs text-[#7B8794] flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 text-[#7B8794]" />
                      {holiday.date} • {holiday.day}
                    </span>
                  </div>

                  <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-[#F0F1EE] text-[#52606D]">
                    {daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `In ${daysLeft}d`}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default UpcomingHolidaysCard;
