import React from "react";

export type BadgeVariant =
  | "ok"
  | "success"   // alias for ok
  | "warn"
  | "warning"   // alias for warn
  | "bad"
  | "danger"    // alias for bad
  | "leave"
  | "info"      // alias for leave
  | "off"
  | "neutral"   // alias for off
  | "lt-casual"
  | "lt-sick"
  | "lt-earned"
  | "lt-comp"
  | "lt-unpaid";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | string;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { pill: string; dot: string }> = {
  ok: {
    pill: "bg-[#E3F3EA] text-[#1E6B45]",
    dot: "bg-[#1E6B45]",
  },
  success: {
    pill: "bg-[#E3F3EA] text-[#1E6B45]",
    dot: "bg-[#1E6B45]",
  },
  warn: {
    pill: "bg-[#FBF0D9] text-[#8A5A00]",
    dot: "bg-[#8A5A00]",
  },
  warning: {
    pill: "bg-[#FBF0D9] text-[#8A5A00]",
    dot: "bg-[#8A5A00]",
  },
  bad: {
    pill: "bg-[#FBE4E1] text-[#A12D22]",
    dot: "bg-[#A12D22]",
  },
  danger: {
    pill: "bg-[#FBE4E1] text-[#A12D22]",
    dot: "bg-[#A12D22]",
  },
  leave: {
    pill: "bg-[#E6EEFB] text-[#274C9E]",
    dot: "bg-[#274C9E]",
  },
  info: {
    pill: "bg-[#E6EEFB] text-[#274C9E]",
    dot: "bg-[#274C9E]",
  },
  off: {
    pill: "bg-[#EEEFEC] text-[#5F6B76]",
    dot: "bg-[#5F6B76]",
  },
  neutral: {
    pill: "bg-[#EEEFEC] text-[#5F6B76]",
    dot: "bg-[#5F6B76]",
  },
  "lt-casual": {
    pill: "bg-[#E8EEFB] text-[#2F5FD0]",
    dot: "bg-[#2F5FD0]",
  },
  "lt-sick": {
    pill: "bg-[#FFF1EC] text-[#C2410C]",
    dot: "bg-[#C2410C]",
  },
  "lt-earned": {
    pill: "bg-[#E3F3EA] text-[#1E6B45]",
    dot: "bg-[#1E6B45]",
  },
  "lt-comp": {
    pill: "bg-[#F2EDFB] text-[#6D4AB5]",
    dot: "bg-[#6D4AB5]",
  },
  "lt-unpaid": {
    pill: "bg-[#EEEFEC] text-[#7B8794]",
    dot: "bg-[#7B8794]",
  },
};

export const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  dot = true,
  children,
  className = "",
  ...props
}) => {
  const conf = variantStyles[variant] || variantStyles.neutral;

  return (
    <span
      className={`inline-flex items-center h-[22px] px-2 text-[12px] font-medium rounded-full select-none whitespace-nowrap ${conf.pill} ${className}`}
      {...props}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full shrink-0 mr-1.5 ${conf.dot}`} />}
      <span>{children}</span>
    </span>
  );
};

export const StatusPill = Badge;
export default StatusPill;
