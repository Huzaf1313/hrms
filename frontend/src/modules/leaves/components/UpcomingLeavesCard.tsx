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

function formatLeaveRange(startStr: string, endStr: string): string {
  const fmt = (raw: string) => {
    const parsed = new Date(`${raw.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
    return parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  const s = startStr.slice(0, 10);
  const e = endStr.slice(0, 10);
  return s === e ? fmt(s) : `${fmt(s)} – ${fmt(e)}`;
}

function getLocalTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export const UpcomingLeavesCard: React.FC<UpcomingLeavesCardProps> = ({
  leaves,
  requests,
  onApplyClick,
  className = "",
}) => {
  const isPersonalMode = !(leaves && leaves.length > 0);

  const items = React.useMemo(() => {
    const todayKey = getLocalTodayKey();

    if (leaves && leaves.length > 0) {
      return leaves
        .filter((l) => l.status === "approved" && l.end_date.slice(0, 10) >= todayKey)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .slice(0, 4)
        .map((l) => ({
          id: l.id,
          primaryLabel: l.employee_name,
          leaveType: l.leave_type,
          dates: formatLeaveRange(l.start_date, l.end_date),
          days: l.total_days,
          status: l.status,
          reason: undefined as string | undefined,
        }));
    }
    if (requests && requests.length > 0) {
      return requests
        .filter((r) => {
          const s = r.status?.toLowerCase();
          if (!s || !["approved", "pending"].includes(s)) return false;
          // Show pending requests or approved leaves from today onwards
          return s === "pending" || r.end_date.slice(0, 10) >= todayKey;
        })
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .slice(0, 4)
        .map((r) => ({
          id: r.id,
          primaryLabel: r.leave_type,
          leaveType: r.leave_type,
          dates: formatLeaveRange(r.start_date, r.end_date),
          days: r.total_days ?? 1,
          status: r.status.toLowerCase() as "approved" | "pending",
          reason: r.reason || undefined,
        }));
    }
    return [];
  }, [leaves, requests]);

  return (
    <div className={`rounded-xl bg-white border border-[#E5E7EB] p-5 shadow-none flex flex-col justify-between h-full ${className}`}>
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-[14px] font-semibold text-[#111827]">Upcoming Leaves</h3>
          </div>
          {onApplyClick ? (
            <button
              type="button"
              onClick={onApplyClick}
              className="text-[12px] font-medium text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer"
            >
              + Apply
            </button>
          ) : (
            <span className="text-[12px] text-[#6B7280]">
              {isPersonalMode ? "Your upcoming schedule" : "Team schedule"}
            </span>
          )}
        </div>

        <div className="mt-3 divide-y divide-[#E5E7EB]">
          {items.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[#6B7280]">
              No upcoming leaves scheduled.
            </div>
          ) : (
            items.map((item) => {
              const meta = getLeaveTypeMeta(item.leaveType);
              return (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {!isPersonalMode && (
                        <User className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                      )}
                      {isPersonalMode && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: meta.accent }}
                        />
                      )}
                      <span className="text-[13px] font-semibold text-[#111827] truncate">
                        {item.primaryLabel}
                      </span>
                    </div>
                    <div className="text-[12px] text-[#6B7280] mt-0.5 truncate">
                      {item.dates} · {item.days} {item.days === 1 ? "day" : "days"}
                      {item.reason ? ` — ${item.reason}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isPersonalMode && (
                      <span
                        className="px-2 py-0.5 text-xs font-medium rounded-full"
                        style={{ backgroundColor: meta.accentBg, color: meta.accent }}
                      >
                        {item.leaveType}
                      </span>
                    )}
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
