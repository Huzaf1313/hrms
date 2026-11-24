import React from "react";
import { Calendar, User } from "lucide-react";
import { StatusPill } from "../../../components/ui/Badge";
import { getLeaveTypeMeta } from "../services/leaveTypes";
import type { MockTeamLeave } from "../../../services/mock/leaveMockService";
import type { LeaveRequest } from "../services/leaveService";

export interface UpcomingLeavesCardProps {
  leaves?: MockTeamLeave[];
  requests?: LeaveRequest[];
  onApplyClick?: () => void;
  className?: string;
}

export const UpcomingLeavesCard: React.FC<UpcomingLeavesCardProps> = ({
  leaves,
  requests,
  onApplyClick,
  className = "",
}) => {
  const items = React.useMemo(() => {
    if (leaves && leaves.length > 0) {
      return leaves
        .filter((l) => l.status === "approved")
        .slice(0, 4)
        .map((l) => ({
          id: l.id,
          employeeName: l.employee_name,
          leaveType: l.leave_type,
          dates: `${l.start_date} to ${l.end_date}`,
          days: l.total_days,
          status: l.status,
        }));
    }
    if (requests && requests.length > 0) {
      return requests
        .filter((r) => r.status && ["approved", "pending"].includes(r.status.toLowerCase()))
        .slice(0, 4)
        .map((r) => ({
          id: r.id,
          employeeName: r.employee_name || "Self",
          leaveType: r.leave_type,
          dates: `${r.start_date} to ${r.end_date}`,
          days: r.total_days ?? 1,
          status: r.status.toLowerCase() as "approved" | "pending",
        }));
    }
    return [];
  }, [leaves, requests]);

  return (
    <div className={`rounded-[8px] bg-white border border-[#E4E6E1] p-[16px_20px] shadow-none flex flex-col justify-between ${className}`}>
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#E4E6E1]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#2F5FD0]" />
            <h3 className="text-[14px] font-semibold text-[#1F2933]">Upcoming Leaves</h3>
          </div>
          {onApplyClick ? (
            <button
              type="button"
              onClick={onApplyClick}
              className="text-[12px] font-medium text-[#2F5FD0] hover:text-[#254FB2] cursor-pointer"
            >
              + Apply
            </button>
          ) : (
            <span className="text-[12px] text-[#7B8794]">Team schedule</span>
          )}
        </div>

        <div className="mt-3 divide-y divide-[#E4E6E1]">
          {items.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-[#7B8794]">
              No upcoming leaves scheduled.
            </div>
          ) : (
            items.map((item) => {
              const meta = getLeaveTypeMeta(item.leaveType);
              return (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#7B8794] shrink-0" />
                      <span className="text-[13px] font-medium text-[#1F2933] truncate">
                        {item.employeeName}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-[#7B8794] mt-0.5">
                      {item.dates} ({item.days} {item.days === 1 ? "day" : "days"})
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="px-2 py-0.5 text-xs font-medium rounded-full"
                      style={{ backgroundColor: meta.accentBg, color: meta.accent }}
                    >
                      {item.leaveType}
                    </span>
                    <StatusPill variant={item.status === "approved" ? "ok" : "warn"}>
                      {item.status === "approved" ? "Approved" : "Pending"}
                    </StatusPill>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default UpcomingLeavesCard;
