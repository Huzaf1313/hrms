import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

import { EXIT_TYPE_META } from "./types";
import { PANEL_CLASS, initialsOf } from "./exitUiUtils";
import type { ExitStatus, ExitType } from "./types";
import type { InlineNotice } from "./exitUiUtils";

/* ------------------------------------------------------------------ badges */

const STATUS_STYLES: Record<ExitStatus, string> = {
  Pending: "bg-amber-50 text-amber-700",
  "In Progress": "bg-blue-50 text-blue-700",
  Completed: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-rose-50 text-rose-700",
  Cancelled: "bg-slate-100 text-slate-500",
};

export function ExitStatusBadge({ status }: { status: ExitStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

const TYPE_CHIP: Record<ExitType, string> = {
  Resignation: "bg-blue-50 text-blue-700",
  Termination: "bg-rose-50 text-rose-700",
};

export function ExitTypeBadge({ type }: { type: string }) {
  const meta = EXIT_TYPE_META[type as ExitType];

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        TYPE_CHIP[type as ExitType] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {meta?.label ?? type}
    </span>
  );
}

/* ----------------------------------------------------------------- avatars */

const AVATAR_TONES = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-cyan-100 text-cyan-700",
];

/** Deterministic tone per name, so the same person keeps the same colour. */
function toneFor(name: string): string {
  let hash = 0;

  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 997;
  }

  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function EmployeeAvatar({
  name,
  size = "md",
}: {
  name: string | null | undefined;
  size?: "sm" | "md";
}) {
  const label = name ?? "?";
  const dimension = size === "sm" ? "h-7 w-7 text-[9px]" : "h-9 w-9 text-[11px]";

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${dimension} ${toneFor(label)}`}
      aria-hidden="true"
    >
      {initialsOf(label)}
    </span>
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
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
            {description && (
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
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
          className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}
          >
            {card.icon}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold leading-tight text-slate-900">
              {card.value}
            </p>
            <p className={`mt-0.5 truncate text-[11px] font-semibold ${card.noteClass}`}>
              {card.note}
            </p>
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
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-4 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${tone}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 break-words">{notice.text}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-lg p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100"
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
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-slate-500">{message}</p>;
}

export function ErrorState({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-rose-600">{message}</p>;
}