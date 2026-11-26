import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

import { Avatar } from "../../components/ui/Avatar";
import { EXIT_TYPE_META } from "./types";
import { PANEL_CLASS } from "./exitUiUtils";
import type { ExitStatus, ExitType } from "./types";
import type { InlineNotice } from "./exitUiUtils";

/* ------------------------------------------------------------------ badges */

const STATUS_STYLES: Record<ExitStatus, { pill: string; dot: string }> = {
  Pending: {
    pill: "bg-amber-50 text-amber-800 border border-amber-200",
    dot: "bg-amber-600",
  },
  "In Progress": {
    pill: "bg-blue-50 text-blue-700 border border-blue-200",
    dot: "bg-blue-600",
  },
  Completed: {
    pill: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    dot: "bg-emerald-600",
  },
  Rejected: {
    pill: "bg-red-50 text-red-700 border border-red-200",
    dot: "bg-red-600",
  },
  Cancelled: {
    pill: "bg-slate-100 text-slate-600 border border-slate-200",
    dot: "bg-slate-500",
  },
};

export function ExitStatusBadge({ status }: { status: ExitStatus }) {
  const tone = STATUS_STYLES[status] ?? STATUS_STYLES.Cancelled;

  return (
    <span
      className={`inline-flex items-center gap-1.5 h-6 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium leading-normal ${tone.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${tone.dot}`} />
      <span>{status}</span>
    </span>
  );
}

const TYPE_CHIP: Record<ExitType, string> = {
  Resignation: "bg-blue-50 text-blue-700 border border-blue-200",
  Termination: "bg-red-50 text-red-700 border border-red-200",
};

export function ExitTypeBadge({ type }: { type: string }) {
  const meta = EXIT_TYPE_META[type as ExitType];

  return (
    <span
      className={`inline-flex items-center h-6 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium leading-normal ${
        TYPE_CHIP[type as ExitType] ?? "bg-slate-100 text-slate-600 border border-slate-200"
      }`}
    >
      {meta?.label ?? type}
    </span>
  );
}

/* ----------------------------------------------------------------- avatars */

export function EmployeeAvatar({
  name,
  size = "md",
}: {
  name: string | null | undefined;
  size?: "sm" | "md";
}) {
  const dimension = size === "sm" ? "!w-8 !h-8 text-[11px]" : "!w-9 !h-9 text-xs";

  return (
    <Avatar
      name={name || "Employee"}
      className={`${dimension} shrink-0`}
    />
  );
}

/* ------------------------------------------------------------------ panels */

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
  bodyClassName = "p-5",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`${PANEL_CLASS} rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex min-w-0 flex-col ${className}`}>
      {title && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-6 py-4">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-[#111827]">{title}</h3>
            {description && (
              <p className="mt-0.5 text-xs text-[#6B7280]">{description}</p>
            )}
          </div>
          {action}
        </header>
      )}

      <div className={`min-w-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------- stat cards */

export interface StatCardSpec {
  label: string;
  value: string | number;
  note: string;
  noteClass: string;
  icon: ReactNode;
  iconBg: string;
  iconClass: string;
  active?: boolean;
  onClick?: () => void;
}

export function StatCards({
  cards,
  className = "",
}: {
  cards: StatCardSpec[];
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {cards.map((card) => {
        const baseClass = `rounded-xl border bg-white p-4 min-h-[108px] shadow-kpi flex flex-col justify-between min-w-0 text-left transition-all duration-150 ${
          card.active
            ? "border-[#2F5FD0] ring-2 ring-[#2F5FD0]/15"
            : "border-[#E5E7EB] hover:border-[#CBD5E1] hover:shadow-sm"
        } ${card.onClick ? "cursor-pointer" : ""}`;

        const inner = (
          <>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-medium text-[#4B5563] truncate">
                {card.label}
              </span>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}
              >
                {card.icon}
              </span>
            </div>

            <div>
              <span className="text-[24px] font-semibold text-[#111827] tabular-nums tracking-tight leading-none block">
                {card.value}
              </span>
              <span className={`text-xs mt-1.5 truncate block leading-none ${card.noteClass}`}>
                {card.note}
              </span>
            </div>
          </>
        );

        return card.onClick ? (
          <button key={card.label} type="button" onClick={card.onClick} className={baseClass}>
            {inner}
          </button>
        ) : (
          <div key={card.label} className={baseClass}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ notices */

export function InlineNoticeBanner({
  notice,
  onDismiss,
}: {
  notice: InlineNotice;
  onDismiss: () => void;
}) {
  if (!notice) return null;

  const Icon = notice.type === "success" ? CheckCircle2 : AlertCircle;
  const tone =
    notice.type === "success"
      ? "border-[#BCF0DA] bg-[#DEF7EC] text-[#03543F]"
      : "border-[#F8B4B4] bg-[#FDE8E8] text-[#9B1C1C]";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-[13px] ${tone}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 break-words">{notice.text}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-current opacity-70 transition hover:bg-black/5 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- skeletons */

export function LoadingRows({
  rows = 5,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2.5 py-4 ${className}`}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-11 animate-pulse rounded-md bg-[#F3F4F6]" />
      ))}
    </div>
  );
}

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <AlertCircle className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-[#374151]">{message}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-[#9B1C1C]">{message}</p>;
}