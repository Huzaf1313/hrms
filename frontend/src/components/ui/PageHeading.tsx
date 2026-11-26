import type { ReactNode } from "react";

export interface PageHeadingProps {
  title: string;
  leading?: ReactNode;
  actions?: ReactNode;
  as?: "h1" | "h3";
  className?: string;
}

export function PageHeading({
  title,
  leading,
  actions,
  as: Tag = "h1",
  className = "",
}: PageHeadingProps) {
  return (
    <div
      className={`flex flex-col gap-3 border-b border-[#E5E7EB] pb-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <Tag className="text-lg sm:text-xl font-semibold tracking-tight leading-[1.3] text-slate-900">
          {title}
        </Tag>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export default PageHeading;
