import React, { useState, type ReactNode } from "react";

export interface AuthFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  autoComplete?: string;
  icon?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const AuthField: React.FC<AuthFieldProps> = ({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  autoComplete,
  icon,
  placeholder = "",
  disabled = false,
  required = false,
  onKeyDown,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const isFloating = isFocused || (value !== undefined && value !== null && value.toString().length > 0);

  return (
    <div className="w-full">
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={onKeyDown}
          autoComplete={autoComplete}
          disabled={disabled}
          required={required}
          placeholder={isFocused ? placeholder : ""}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`peer w-full rounded-xl border bg-surface px-4 pt-5 pb-2 text-sm font-medium text-ink-900 outline-none transition-all duration-150 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-ink-300 ${
            icon ? "pr-11" : ""
          } ${
            error
              ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              : "border-line focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20"
          }`}
        />

        {/* Floating Label */}
        <label
          htmlFor={id}
          className={`technical-label pointer-events-none absolute left-4 transition-all duration-150 ${
            isFloating
              ? "top-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400"
              : "top-3.5 text-sm font-medium text-ink-400"
          } ${isFocused && !error ? "text-brand-600" : ""} ${
            error ? "text-red-600" : ""
          }`}
        >
          {label}
        </label>

        {/* Optional Right Action/Icon Slot */}
        {icon && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400">
            {icon}
          </div>
        )}
      </div>

      {/* Inline accessible error */}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          aria-live="polite"
          className="mt-1.5 text-xs font-medium text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  );
};
