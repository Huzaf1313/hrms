/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { Check, Circle } from "lucide-react";

export interface PasswordRule {
  label: string;
  test: (value: string) => boolean;
}

export const passwordRules: PasswordRule[] = [
  {
    label: "At least 8 characters",
    test: (value: string) => value.length >= 8,
  },
  {
    label: "One uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    label: "One lowercase letter",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    label: "One number",
    test: (value: string) => /[0-9]/.test(value),
  },
  {
    label: "One special character",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
];

export function scorePassword(value: string): number {
  if (!value) return 0;
  return passwordRules.reduce((acc, rule) => (rule.test(value) ? acc + 1 : acc), 0);
}

export interface PasswordStrengthProps {
  value: string;
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({ value }) => {
  if (!value) return null;

  const score = scorePassword(value);

  // Determine segment color based on score
  const getSegmentColor = (index: number) => {
    if (index >= score) {
      return "bg-slate-200";
    }
    if (score <= 2) {
      return "bg-rose-500";
    }
    if (score <= 3) {
      return "bg-amber-500";
    }
    if (score === 4) {
      return "bg-brand-500";
    }
    return "bg-emerald-500";
  };

  const getStrengthLabel = () => {
    if (score <= 1) return { text: "Very Weak", color: "text-rose-500" };
    if (score === 2) return { text: "Weak", color: "text-rose-500" };
    if (score === 3) return { text: "Moderate", color: "text-amber-500" };
    if (score === 4) return { text: "Good", color: "text-brand-600" };
    return { text: "Strong", color: "text-emerald-600" };
  };

  const strength = getStrengthLabel();

  return (
    <div className="mt-2.5 space-y-2">
      {/* 5-segment bar */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex flex-1 items-center gap-1.5">
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className={`h-1.5 flex-1 rounded-full transition-all duration-200 ${getSegmentColor(
                index
              )}`}
            />
          ))}
        </div>
        <span
          className={`technical-label text-[11px] font-semibold tracking-wide ${strength.color}`}
        >
          {strength.text}
        </span>
      </div>

      {/* Rules list */}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 pt-0.5">
        {passwordRules.map((rule) => {
          const passed = rule.test(value);
          return (
            <li
              key={rule.label}
              className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                passed ? "text-emerald-600" : "text-ink-400"
              }`}
            >
              {passed ? (
                <Check aria-hidden="true" className="h-3 w-3 shrink-0 text-emerald-600" />
              ) : (
                <Circle aria-hidden="true" className="h-3 w-3 shrink-0 text-slate-300" />
              )}
              <span>{rule.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
