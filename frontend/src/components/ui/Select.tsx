import React from "react";
import { AlertCircle, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options?: SelectOption[];
  wrapperClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      options,
      children,
      className = "",
      wrapperClassName = "",
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className={`flex flex-col gap-1 ${wrapperClassName || "w-full"}`}>
        {label && (
          <label htmlFor={selectId} className="text-[13px] font-medium text-[#374151]">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={`h-9 w-full appearance-none rounded-lg border bg-white pl-3 pr-8 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] transition-colors focus:outline-none focus:ring-[3px] focus:ring-[#DBEAFE] focus:border-[#2563EB] disabled:bg-[#F3F4F6] disabled:text-[#6B7280] disabled:border-[#E5E7EB] disabled:cursor-not-allowed ${
              error
                ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#FEE2E2]"
                : "border-[#D1D5DB] hover:border-[#9CA3AF]"
            } ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
              : children}
          </select>
          <div className="absolute right-2.5 flex items-center pointer-events-none text-[#7B8794]">
            <ChevronDown className="w-4 h-4" />
          </div>
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

Select.displayName = "Select";
export default Select;
