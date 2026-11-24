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

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 ${className}`}>
      {balances
        .filter((b) => b.leave_type !== "Unpaid Leave")
        .map((b) => {
          const meta = getLeaveTypeMeta(b.leave_type);
          const percent = b.allocated > 0 ? Math.min(100, Math.round((b.used / b.allocated) * 100)) : 0;

          return (
            <div
              key={b.leave_type}
              onClick={() => handleApply(b.leave_type)}
              className={`rounded-[8px] bg-white border border-[#E4E6E1] p-[16px_20px] shadow-kpi transition-colors ${
                onApply || onApplyType ? "cursor-pointer hover:border-[#2F5FD0] shadow-kpi-hover" : ""
              }`}
            >
              {/* Header with Type label and Top Accent Indicator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: meta.accent }}
                  />
                  <h4 className="text-[13.5px] font-semibold text-[#1F2933] truncate">
                    {b.leave_type}
                  </h4>
                </div>
                <span className="text-xs font-medium text-[#7B8794]">
                  {b.used}/{b.allocated} used
                </span>
              </div>

              {/* Big KPI Number for Available Days */}
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-[24px] font-semibold text-[#1F2933] tracking-tight leading-none">
                    {b.available}
                  </span>
                  <span className="text-[12px] text-[#7B8794] ml-1.5 font-normal">
                    days available
                  </span>
                </div>
              </div>

              {/* Custom Accent Progress Bar */}
              <div className="mt-3.5 w-full bg-[#F0F1EE] h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: meta.accent,
                  }}
                />
              </div>

              {/* Subtitle helper */}
              <div className="mt-2 text-xs text-[#7B8794] truncate">
                {meta.description}
              </div>
            </div>
          );
        })}
    </div>
  );
};

export default LeaveBalanceCards;
