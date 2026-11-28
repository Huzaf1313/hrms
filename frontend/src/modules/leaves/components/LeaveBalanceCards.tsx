import React from "react";
import { getLeaveTypeMeta } from "../services/leaveTypes";
import type { EmployeeLeaveBalance } from "../services/leaveService";

export interface LeaveBalanceCardsProps {
  balances: EmployeeLeaveBalance[];
  onApply?: (type?: string) => void;
  onApplyType?: (type: string) => void;
  className?: string;
}

export const LeaveBalanceCards: React.FC<LeaveBalanceCardsProps> = ({
  balances,
  onApply,
  onApplyType,
  className = "",
}) => {
  const handleApply = (type: string) => {
    if (onApply) onApply(type);
    else if (onApplyType) onApplyType(type);
  };

  const visibleBalances = balances.filter((b) => b.leave_type !== "Unpaid Leave");
  const gridColsClass =
    visibleBalances.length === 1
      ? "grid-cols-1"
      : visibleBalances.length === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : visibleBalances.length === 3
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={`grid ${gridColsClass} gap-4 ${className}`}>
      {visibleBalances.map((b) => {
          const meta = getLeaveTypeMeta(b.leave_type);
          const percent = b.allocated > 0 ? Math.min(100, Math.round((b.used / b.allocated) * 100)) : 0;

          return (
            <div
              key={b.leave_type}
              onClick={() => handleApply(b.leave_type)}
              className={`group rounded-[2px] bg-white border-2 border-[#E5E7EB] p-5 shadow-kpi transition-colors ${
                onApply || onApplyType ? "cursor-pointer hover:border-[#2563EB] shadow-kpi-hover" : ""
              }`}
            >
              {/* Header with Type label and Top Accent Indicator */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: meta.accent }}
                  />
                  <h4 className="text-[13.5px] font-semibold text-[#111827] truncate">
                    {b.leave_type}
                  </h4>
                </div>
                <span className="text-xs font-medium text-[#6B7280] shrink-0">
                  {b.used}/{b.allocated} used
                </span>
              </div>

              {/* Big KPI Number for Available Days */}
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-[26px] font-semibold text-[#111827] tracking-tight leading-none">
                    {b.available}
                  </span>
                  <span className="text-[12px] text-[#6B7280] ml-1.5 font-normal">
                    days available
                  </span>
                </div>
                {(onApply || onApplyType) && (
                  <span className="text-[11px] font-medium text-[#2563EB] opacity-0 transition-opacity group-hover:opacity-100">
                    Apply →
                  </span>
                )}
              </div>

              {/* Custom Accent Progress Bar */}
              <div className="mt-3.5 w-full bg-[#F3F4F6] h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: meta.accent,
                  }}
                />
              </div>

              {/* Subtitle helper */}
              <div className="mt-2.5 text-xs text-[#6B7280] truncate">
                {meta.description}
              </div>
            </div>
          );
        })}
    </div>
  );
};

export default LeaveBalanceCards;
