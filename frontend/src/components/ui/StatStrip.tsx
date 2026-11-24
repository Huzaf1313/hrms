import React from "react";

export interface StatItem {
  label: string;
  value: string | number;
  helper?: string;
  dotColor?: string; // e.g. "bg-[#1E6B45]" or "bg-[#8A5A00]"
}

export interface StatStripProps {
  items: StatItem[];
  className?: string;
}

export const StatStrip: React.FC<StatStripProps> = ({ items, className = "" }) => {
  return (
    <div
      className={`rounded-[8px] bg-white border border-[#E4E6E1] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#E4E6E1] shadow-kpi ${className}`}
    >
      {items.map((item, idx) => (
        <div key={idx} className="p-[16px_20px] flex flex-col justify-between min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {item.dotColor && (
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${item.dotColor}`} />
            )}
            <span className="text-[12px] font-medium text-[#7B8794] truncate">
              {item.label}
            </span>
          </div>

          <div className="mt-2">
            <span className="text-[24px] font-semibold text-[#1F2933] tracking-tight leading-none">
              {item.value}
            </span>
          </div>

          {item.helper && (
            <span className="text-[12px] text-[#7B8794] mt-1.5 truncate">
              {item.helper}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

export default StatStrip;
