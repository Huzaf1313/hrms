import React from "react";
import { FolderOpen } from "lucide-react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title = "No data found",
  description = "There are no records matching your request.",
  action,
  className = "",
}) => {
  return (
    <div
      className={`mx-auto flex max-w-sm flex-col items-center justify-center p-6 text-center ${className}`}
    >
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-[#D1D5DB] bg-white text-[#9CA3AF]">
        {icon || <FolderOpen className="h-4 w-4 shrink-0 stroke-[1.5]" />}
      </div>
      <h3 className="text-[13px] font-semibold text-[#111827]">{title}</h3>
      {description && <p className="mt-1 text-[12px] leading-normal text-[#6B7280]">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
};
