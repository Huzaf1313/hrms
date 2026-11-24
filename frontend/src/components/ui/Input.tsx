import React from "react";
import { AlertCircle } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      className = "",
      wrapperClassName = "",
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className={`flex flex-col gap-1 w-full ${wrapperClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-[#374151] flex items-center justify-between"
          >
            <span>{label}</span>
          </label>
        )}
        <div className="relative flex w-full items-center">
          {leftIcon && (
            <div className="absolute left-2.5 flex items-center pointer-events-none text-[#7B8794]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`h-10 w-full rounded-lg border bg-white px-3 text-[14px] text-[#111827] placeholder:text-[#9CA3AF] transition-colors focus:outline-none focus:ring-[3px] focus:ring-[#DBEAFE] focus:border-[#2563EB] disabled:bg-[#F3F4F6] disabled:text-[#6B7280] disabled:border-[#E5E7EB] disabled:cursor-not-allowed ${
              leftIcon ? "pl-9" : ""
            } ${rightIcon ? "pr-9" : ""} ${
              error
                ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#FEE2E2] text-[#B91C1C]"
                : "border-[#D1D5DB] hover:border-[#9CA3AF]"
              } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-2.5 flex items-center pointer-events-none text-[#7B8794]">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-[#DC2626]">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-[#7B8794] mt-0.5">{hint}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
export default Input;
