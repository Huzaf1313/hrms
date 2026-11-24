import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  hideCloseButton?: boolean;
}

const maxWidthMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "md",
  className = "",
  hideCloseButton = false,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    if (open) {
      if (!el.open) {
        el.showModal();
      }
    } else {
      if (el.open) {
        el.close();
      }
    }
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={`backdrop:bg-[rgba(17,24,39,0.5)] p-0 bg-transparent rounded-2xl border-0 shadow-2xl text-slate-900 overflow-hidden w-full m-auto ${maxWidth === "2xl" ? "max-w-[720px]" : maxWidthMap[maxWidth]} ${className}`}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        {(title || !hideCloseButton) && (
          <div className="flex items-start justify-between border-b border-[#E5E7EB] px-6 py-5">
            <div>
               {title && <h3 className="text-[18px] font-semibold text-[#111827]">{title}</h3>}
              {description && (
                  <p className="mt-1 text-[13px] text-[#6B7280]">{description}</p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </dialog>
  );
};
