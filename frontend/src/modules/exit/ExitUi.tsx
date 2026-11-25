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
    pill: "bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]",
    dot: "bg-[#92400E]",
  },
  "In Progress": {
    pill: "bg-[#E8EEFB] text-[#2F5FD0]",
    dot: "bg-[#2F5FD0]",
  },
  Completed: {
    pill: "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]",
    dot: "bg-[#03543F]",
  },
  Rejected: {
    pill: "bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]",
    dot: "bg-[#9B1C1C]",
  },
  Cancelled: {
    pill: "bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]",
    dot: "bg-[#7B8794]",
  },
};

export function ExitStatusBadge({ status }: { status: ExitStatus }) {
  const tone = STATUS_STYLES[status] ?? STATUS_STYLES.Cancelled;

  return (
    <span
      className={`inline-flex items-center gap-1.5 h-[22px] whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-normal ${tone.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${tone.dot}`} />
      <span>{status}</span>
    </span>
  );
}

const TYPE_CHIP: Record<ExitType, string> = {
  Resignation: "bg-[#E8EEFB] text-[#2F5FD0]",
  Termination: "bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]",
};

export function ExitTypeBadge({ type }: { type: string }) {
  const meta = EXIT_TYPE_META[type as ExitType];

  return (
    <span
      className={`inline-flex items-center h-[22px] whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-normal ${
        TYPE_CHIP[type as ExitType] ?? "bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]"
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
    <section className={`${PANEL_CLASS} flex min-w-0 flex-col ${className}`}>
      {title && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-6 py-3.5">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-[#111827]">{title}</h3>
            {description && (
              <p className="mt-0.5 text-xs text-[#4B5563]">{description}</p>
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
}

export function StatCards({
  cards,
  className = "",
}: {
  cards: StatCardSpec[];
  className?: string;
}) {
  return (
    <div className={`grid gap-4 ${className}`}>
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-[#E5E7EB] bg-white p-4 h-[104px] shadow-kpi flex flex-col justify-between min-w-0"
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-xs font-medium text-[#4B5563] truncate">
              {card.label}
            </span>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${card.iconBg}`}
            >
              {card.icon}
            </span>
          </div>

          <div>
            <span className="text-[24px] font-semibold text-[#111827] tabular-nums tracking-tight leading-none block">
              {card.value}
            </span>
            <span className={`text-[11px] mt-1 truncate block leading-none ${card.noteClass}`}>
              {card.note}
            </span>
          </div>
        </div>
      ))}
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

export function EmptyState({ message }: { message: string }) {
  return <p className="py-10 text-center text-xs text-[#6B7280]">{message}</p>;
}

export function ErrorState({ message }: { message: string }) {
  return <p className="py-10 text-center text-xs text-[#9B1C1C]">{message}</p>;
}