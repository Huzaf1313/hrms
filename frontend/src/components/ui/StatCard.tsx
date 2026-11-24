import React from "react";

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  dotColor?: string; // Small colored dot indicator
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  badge,
  icon,
  dotColor,
  className = "",
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`rounded-lg border border-slate-200 bg-white p-3.5 shadow-kpi transition-colors ${
        onClick ? "cursor-pointer hover:border-slate-300 shadow-kpi-hover" : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {dotColor && <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />}
          <span className="text-xs font-medium text-slate-500 truncate">{label}</span>
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 shrink-0 [&>svg]:w-5 [&>svg]:h-5 [&>svg]:shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-xl font-bold tracking-tight text-slate-900 font-mono">
          {value}
        </span>
        {badge && <span className="shrink-0">{badge}</span>}
      </div>

      {subtext && (
        <p className="mt-1 text-xs text-slate-500 truncate">{subtext}</p>
      )}
    </div>
  );
};
