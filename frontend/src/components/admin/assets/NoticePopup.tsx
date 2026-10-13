import { useEffect } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

export type Notice = { type: "success" | "error"; text: string } | null;

interface NoticePopupProps {
  notice: Notice;
  onDismiss: () => void;
  /** Milliseconds before it fades itself out. */
  timeout?: number;
}

const TONES = {
  success: {
    ring: "border-emerald-200",
    iconWrap: "bg-emerald-50 text-emerald-600",
    Icon: CheckCircle2,
    title: "Done",
  },
  error: {
    ring: "border-rose-200",
    iconWrap: "bg-rose-50 text-rose-600",
    Icon: AlertCircle,
    title: "Something went wrong",
  },
} as const;

/**
 * Transient confirmation popup.
 *
 * Anchored bottom-right so it never covers the page title or the table the
 * action came from. It dismisses itself, but only once a popup is actually on
 * screen - the timer is registered inside the branch that renders it, so
 * mounting with nothing to show does not arm a stray timeout.
 */
export default function NoticePopup({
  notice,
  onDismiss,
  timeout = 4000,
}: NoticePopupProps) {
  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(onDismiss, timeout);

    return () => window.clearTimeout(timer);
  }, [notice, onDismiss, timeout]);

  if (!notice) return null;

  const tone = TONES[notice.type];
  const Icon = tone.Icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 right-6 z-[70] w-full max-w-sm px-4 sm:px-0"
    >
      <div
        key={notice.text}
        className={`dashboard-pop pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-xl shadow-slate-900/10 ${tone.ring}`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.iconWrap}`}
        >
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold text-slate-900">{tone.title}</p>
          <p className="mt-0.5 break-words text-sm leading-5 text-slate-500">
            {notice.text}
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}