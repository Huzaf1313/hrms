import React from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  isLoading = false,
}) => {
  const buttonVariant =
    variant === "danger" ? "danger" : variant === "warning" ? "primary" : "primary";

  const icon =
    variant === "danger" ? (
      <div className="h-9 w-9 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
        <AlertCircle className="w-5 h-5" />
      </div>
    ) : variant === "warning" ? (
      <div className="h-9 w-9 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-5 h-5" />
      </div>
    ) : (
      <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-5 h-5" />
      </div>
    );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" hideCloseButton>
      <div className="flex items-start gap-3.5">
        {icon}
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <div className="mt-1 text-xs text-slate-500 leading-normal">{description}</div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
        <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading} className="rounded">
          {cancelLabel}
        </Button>
        <Button
          variant={buttonVariant}
          size="sm"
          onClick={onConfirm}
          isLoading={isLoading}
          className="rounded"
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
};
