import { useEffect, useRef, type ReactNode } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

/**
 * What the popup should say. `null` means nothing to show, so callers can hold
 * a single piece of state and clear it to close the popup.
 */
export type Notice = {
  type: "success" | "error";
  text: string;
  /** Replaces the default heading ("Done" / "Something went wrong"). */
  title?: string;
} | null;

interface NoticePopupProps {
  notice: Notice;
  onDismiss: () => void;
  /** Milliseconds before a success popup closes itself. Errors stay until
   *  dismissed, so they cannot be missed. */
  timeout?: number;
  /** Extra detail shown under the text. */
  children?: ReactNode;
}

/** Colours, icon and fallback heading for each notice type. */
const TONES = {
  success: {
    iconWrap: "bg-emerald-50 text-emerald-600",
    button: "bg-emerald-600 hover:bg-emerald-700",
    Icon: CheckCircle2,
    title: "Done",
  },
  error: {
    iconWrap: "bg-rose-50 text-rose-600",
    button: "bg-rose-600 hover:bg-rose-700",
    Icon: AlertCircle,
    title: "Something went wrong",
  },
} as const;

/**
 * The app's one confirmation popup: a centered dialog used wherever an action
 * reports its result, in place of corner toasts and inline banners.
 */
export default function NoticePopup({
  notice,
  onDismiss,
  timeout = 4000,
  children,
}: NoticePopupProps) {
  // Callers often pass an inline function; keeping it in a ref stops a
  // re-render from restarting the auto-close timer.
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  // Keyed on the primitives rather than the notice object, which callers
  // usually rebuild on every render. A new message (different text) still
  // restarts the timer.
  const type = notice?.type;
  const text = notice?.text;

  useEffect(() => {
    if (!type) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissRef.current();
    };

    window.addEventListener("keydown", onKey);

    const timer =
      type === "success"
        ? window.setTimeout(() => dismissRef.current(), timeout)
        : undefined;

    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [type, text, timeout]);

  if (!notice) return null;

  const tone = TONES[notice.type];
  const Icon = tone.Icon;
  const title = notice.title ?? tone.title;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-6"
      // A click on the backdrop dismisses; the dialog below stops its own
      // clicks from reaching here.
      onClick={onDismiss}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-[2px] bg-white p-6 text-center shadow-xl"
      >
        <span
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${tone.iconWrap}`}
        >
          <Icon className="h-6 w-6" />
        </span>

        <h2 className="mt-4 text-base font-semibold text-slate-900">{title}</h2>

        {notice.text && (
          <p className="mt-1 break-words text-sm leading-5 text-slate-500">
            {notice.text}
          </p>
        )}

        {children}

        <button
          type="button"
          onClick={onDismiss}
          autoFocus
          className={`mt-6 inline-flex h-10 w-full items-center justify-center rounded px-5 text-sm font-semibold text-white shadow-sm transition ${tone.button}`}
        >
          OK
        </button>
      </div>
    </div>
  );
}
