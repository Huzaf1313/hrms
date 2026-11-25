import React from "react";

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
            className="text-[12px] font-medium text-[#52606D] flex items-center justify-between"
          >
            <span>{label}</span>
          </label>
        )}
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-2.5 flex items-center pointer-events-none text-[#7B8794]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full h-[34px] rounded-[6px] border bg-white px-3 text-[13.5px] text-[#1F2933] placeholder:text-[#7B8794] transition-colors focus:outline-none focus:ring-1 focus:ring-[#2F5FD0] focus:border-[#2F5FD0] disabled:bg-[#F6F7F5] disabled:text-[#7B8794] disabled:border-[#E4E6E1] disabled:cursor-not-allowed ${
              leftIcon ? "pl-9" : ""
            } ${rightIcon ? "pr-9" : ""} ${
              error
                ? "border-[#A12D22] focus:border-[#A12D22] focus:ring-[#A12D22] text-[#A12D22]"
                : "border-[#E4E6E1] hover:border-[#D1D5DB]"
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
          <p className="text-xs text-[#A12D22] mt-0.5">{error}</p>
        ) : hint ? (
          <p className="text-xs text-[#7B8794] mt-0.5">{hint}</p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
export default Input;
