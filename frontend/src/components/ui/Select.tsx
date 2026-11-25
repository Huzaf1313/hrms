import React from "react";
import { ChevronDown } from "lucide-react";

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
          <label htmlFor={selectId} className="text-xs font-medium text-[#52606D]">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={`w-full h-10 appearance-none rounded-[6px] border bg-white pl-3 pr-8 text-sm text-[#1F2933] placeholder:text-[#7B8794] transition-colors focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] focus:border-[#2F5FD0] disabled:bg-[#F6F7F5] disabled:text-[#7B8794] disabled:border-[#E4E6E1] disabled:cursor-not-allowed ${
              error
                ? "border-[#A12D22] focus:border-[#A12D22] focus:ring-[#A12D22]"
                : "border-[#E4E6E1] hover:border-[#D1D5DB]"
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
          <p className="text-xs text-[#A12D22] mt-0.5">{error}</p>
        ) : hint ? (
          <p className="text-xs text-[#7B8794] mt-0.5">{hint}</p>
        ) : null}
      </div>
    );
  },
);

Select.displayName = "Select";
export default Select;
