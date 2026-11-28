import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "rounded";
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

/**
 * Base atomic Skeleton component for loading placeholders.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = "",
  variant = "rounded",
  width,
  height,
  animate = true,
  style,
  ...props
}) => {
  const variantStyles = {
    text: "h-4 w-full rounded",
    circular: "rounded-full aspect-square",
    rectangular: "rounded-none",
    rounded: "rounded-xl",
  };

  const styleObj: React.CSSProperties = {
    ...(width !== undefined ? { width: typeof width === "number" ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === "number" ? `${height}px` : height } : {}),
    ...style,
  };

  return (
    <div
      aria-hidden="true"
      className={`bg-slate-200/80 ${animate ? "animate-pulse" : ""} ${variantStyles[variant]} ${className}`}
      style={styleObj}
      {...props}
    />
  );
};

/* =====================================================================
   Composite Skeleton Loaders for Data-Fetching States
===================================================================== */

export interface StatCardSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Skeleton for KPI & metrics rows (Admin Dashboard, Employee Dashboard).
 */
export const StatCardSkeleton: React.FC<StatCardSkeletonProps> = ({
  count = 4,
  className = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
}) => {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-[2px] border-2 border-slate-200 bg-white p-5 shadow-kpi space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton variant="text" className="h-4 w-24" />
            <Skeleton variant="rounded" className="h-10 w-10 rounded-xl" />
          </div>
          <Skeleton variant="text" className="h-8 w-28" />
          <div className="flex items-center gap-2 pt-1">
            <Skeleton variant="rounded" className="h-4 w-12 rounded-full" />
            <Skeleton variant="text" className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
};

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

/**
 * Realistic Data Table Skeleton with column headers and cell rows.
 */
export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 5,
  showHeader = true,
  className = "",
}) => {
  // Stagger widths for high visual realism
  const widths = ["w-3/4", "w-2/3", "w-1/2", "w-4/5", "w-3/5"];

  return (
    <div className={`w-full overflow-hidden rounded-[2px] border border-slate-100 bg-white ${className}`}>
      {showHeader && (
        <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="flex-1">
              <Skeleton
                variant="text"
                className={`h-4 ${widths[colIndex % widths.length]} bg-slate-300/80`}
              />
            </div>
          ))}
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-4 px-6 py-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={colIndex} className="flex-1">
                <Skeleton
                  variant="text"
                  className={`h-4 ${widths[(rowIndex + colIndex) % widths.length]}`}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export interface TableRowSkeletonProps {
  rows?: number;
  columns?: number;
}

/**
 * Skeleton rows for rendering inside existing <table><tbody> elements.
 */
export const TableRowSkeleton: React.FC<TableRowSkeletonProps> = ({
  rows = 5,
  columns = 5,
}) => {
  const widths = ["w-3/4", "w-2/3", "w-1/2", "w-4/5", "w-3/5"];

  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-slate-100/80">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="px-6 py-4">
              <Skeleton
                variant="text"
                className={`h-4 ${widths[(rowIndex + colIndex) % widths.length]}`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export interface CardSkeletonProps {
  count?: number;
  lines?: number;
  className?: string;
}

/**
 * Skeleton for announcement lists, documents, or feeds.
 */
export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  count = 3,
  lines = 2,
  className = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
}) => {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-[2px] border border-slate-100 bg-white p-6 shadow-none space-y-4"
        >
          <div className="flex items-center gap-3">
            <Skeleton variant="circular" className="h-10 w-10" />
            <div className="flex-1 space-y-1.5">
              <Skeleton variant="text" className="h-4 w-3/4" />
              <Skeleton variant="text" className="h-3 w-1/2" />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {Array.from({ length: lines }).map((_, lineIndex) => (
              <Skeleton
                key={lineIndex}
                variant="text"
                className={`h-3.5 ${lineIndex === lines - 1 ? "w-4/5" : "w-full"}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Skeleton variant="rounded" className="h-6 w-16 rounded-full" />
            <Skeleton variant="text" className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
};

export interface FormSkeletonProps {
  fields?: number;
  className?: string;
}

/**
 * Skeleton for edit modals, settings, and form sections.
 */
export const FormSkeleton: React.FC<FormSkeletonProps> = ({
  fields = 4,
  className = "space-y-4",
}) => {
  return (
    <div className={className}>
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton variant="text" className="h-3.5 w-28" />
          <Skeleton variant="rounded" className="h-12 w-full rounded-[2px]" />
        </div>
      ))}
      <div className="flex justify-end gap-3 pt-4">
        <Skeleton variant="rounded" className="h-10 w-24 rounded-xl" />
        <Skeleton variant="rounded" className="h-10 w-32 rounded-xl" />
      </div>
    </div>
  );
};

export interface PageHeaderSkeletonProps {
  className?: string;
}

/**
 * Skeleton for page headers (Title, Subtitle, and Action Button).
 */
export const PageHeaderSkeleton: React.FC<PageHeaderSkeletonProps> = ({
  className = "mb-6 flex flex-wrap items-start justify-between gap-4",
}) => {
  return (
    <div className={className}>
      <div className="space-y-2">
        <Skeleton variant="text" className="h-8 w-48 sm:w-64" />
        <Skeleton variant="text" className="h-4 w-36 sm:w-80" />
      </div>
      <Skeleton variant="rounded" className="h-10 w-36 rounded-full" />
    </div>
  );
};
