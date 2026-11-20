import React from "react";

export type BadgeVariant =
  | "success" // green  - Present, Approved, Active
  | "warning" // amber  - Late, Pending, In Progress
  | "danger"  // red    - Absent, Rejected, Terminated
  | "info"    // blue   - Leave, Information, WFH
  | "neutral" // gray   - Holiday, Weekend, Inactive
  | "violet"  // violet - Special Leave, Casual
  | "teal";   // teal   - Overtime, Remote

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  size?: "xs" | "sm" | "md";
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { pill: string; dot: string }> = {
  success: {
    // Present / Approved - soft tinted background with darker text of same hue, 6px dot, NO border
    pill: "bg-[#E6F4EA] text-[#137333]",
    dot: "bg-[#137333]",
  },
  warning: {
    // Late / Pending - soft amber tint
    pill: "bg-[#FEF7E0] text-[#B06000]",
    dot: "bg-[#B06000]",
  },
  danger: {
    // Absent / Rejected - muted red tint (#FBE4E1 bg, #A12D22 text)
    pill: "bg-[#FBE4E1] text-[#A12D22]",
    dot: "bg-[#A12D22]",
  },
  info: {
    // Leave / On Leave / Info - soft blue tint
    pill: "bg-[#E8F0FE] text-[#1A73E8]",
    dot: "bg-[#1A73E8]",
  },
  neutral: {
    // Holiday / Weekend / Neutral - soft slate tint
    pill: "bg-[#F1F3F4] text-[#5F6368]",
    dot: "bg-[#5F6368]",
  },
  violet: {
    pill: "bg-[#F3E8FF] text-[#6B21A8]",
    dot: "bg-[#6B21A8]",
  },
  teal: {
    pill: "bg-[#E6FFFA] text-[#0D9488]",
    dot: "bg-[#0D9488]",
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
