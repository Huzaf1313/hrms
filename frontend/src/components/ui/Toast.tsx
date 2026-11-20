import React, { useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { ToastContext, type ToastType, type ToastItem } from "./useToast";

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
  error: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
  info: <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
};

const borderMap: Record<ToastType, string> = {
  success: "border-emerald-200 bg-white text-slate-900",
  error: "border-rose-200 bg-white text-slate-900",
  info: "border-blue-200 bg-white text-slate-900",
  warning: "border-amber-200 bg-white text-slate-900",
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({
      type = "info",
      title,
      message,
      duration = 4000,
    }: {
      type?: ToastType;
      title?: string;
      message: string;
      duration?: number;
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast],
  );

  const success = useCallback(
    (message: string, title?: string) => showToast({ type: "success", message, title }),
    [showToast],
  );
  const error = useCallback(
    (message: string, title?: string) => showToast({ type: "error", message, title }),
    [showToast],
  );
  const info = useCallback(
    (message: string, title?: string) => showToast({ type: "info", message, title }),
    [showToast],
  );
  const warning = useCallback(
    (message: string, title?: string) => showToast({ type: "warning", message, title }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      {/* Toast container floating at top-right */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-3 rounded-lg border shadow-md animate-in slide-in-from-top-2 duration-150 ${borderMap[toast.type]}`}
          >
            {iconMap[toast.type]}
            <div className="flex-1 min-w-0">
              {toast.title && (
                <div className="text-xs font-semibold text-slate-900">{toast.title}</div>
              )}
              <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                {toast.message}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
