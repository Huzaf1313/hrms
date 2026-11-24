import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "./Button";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Failed to load data",
  message = "An error occurred while fetching information. Please try again.",
  onRetry,
  className = "",
}) => {
  return (
    <div
      className={`mx-auto flex max-w-sm flex-col items-center justify-center p-6 text-center ${className}`}
    >
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]">
        <AlertCircle className="h-4 w-4 stroke-[1.75]" />
      </div>
      <h3 className="text-[13px] font-semibold text-[#111827]">{title}</h3>
      <p className="mt-1 text-[12px] leading-normal text-[#6B7280]">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
};
