import React, { useRef } from "react";
import { Calendar } from "lucide-react";
import { formatDisplayDate } from "../../utils/dateKeys";

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      label,
      error,
      hint,
      className = "",
      wrapperClassName = "",
      id,
      disabled,
      value,
      onChange,
      ...props
    },
    forwardedRef,
  ) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const inputRef = (forwardedRef as React.RefObject<HTMLInputElement>) || internalRef;
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    const displayString = value ? formatDisplayDate(String(value)) : "Select date";

    const handleClick = () => {
      if (disabled) return;
      try {
        if (inputRef.current) {
          if (typeof inputRef.current.showPicker === "function") {
            inputRef.current.showPicker();
          } else {
            inputRef.current.focus();
          }
        }
      } catch {
        inputRef.current?.focus();
      }
    };

    return (
      <div className={`flex flex-col gap-1 w-full ${wrapperClassName}`}>
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-slate-700">
            {label}
          </label>
        )}
        <div
          onClick={handleClick}
          className={`relative flex items-center justify-between w-full h-[32px] rounded-[6px] border bg-white px-2.5 text-[13px] text-[#111827] cursor-pointer select-none transition-colors ${
            error
              ? "border-rose-400 focus-within:border-rose-500"
              : "border-[#E5E7EB] hover:border-[#D1D5DB]"
          } ${disabled ? "bg-[#F9FAFB] text-[#9CA3AF] cursor-not-allowed" : ""} ${className}`}
        >
          <span className="truncate font-medium">{displayString}</span>
          <Calendar className="w-4 h-4 text-[#6B7280] shrink-0 ml-1.5 pointer-events-none" />

          {/* Native date input visually invisible but functional for calendar popup */}
          <input
            ref={inputRef}
            type="date"
            id={inputId}
            disabled={disabled}
            value={value}
            onChange={onChange}
            tabIndex={-1}
            aria-hidden="true"
            className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs text-rose-600 mt-0.5">{error}</p>
        ) : hint ? (
          <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
        ) : null}
      </div>
    );
  },
);

DatePicker.displayName = "DatePicker";
export default DatePicker;
