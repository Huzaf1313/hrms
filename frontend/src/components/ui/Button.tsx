import React from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#2F5FD0] text-white hover:bg-[#264FB0] active:bg-[#264FB0] border-transparent disabled:bg-[#2F5FD0]/50 disabled:cursor-not-allowed",
  secondary:
    "bg-[#F0F1EE] text-[#1F2933] hover:bg-[#E4E6E1] active:bg-[#E4E6E1] border-transparent disabled:bg-[#F6F7F5] disabled:text-[#7B8794] disabled:cursor-not-allowed",
  outline:
    "bg-white text-[#1F2933] border-[#E4E6E1] hover:bg-[#F0F1EE] hover:border-[#E4E6E1] active:bg-[#E4E6E1] disabled:bg-[#F6F7F5] disabled:text-[#7B8794] disabled:border-[#E4E6E1] disabled:cursor-not-allowed",
  ghost:
    "bg-transparent text-[#52606D] hover:bg-[#F0F1EE] hover:text-[#1F2933] active:bg-[#E4E6E1] border-transparent disabled:text-[#7B8794] disabled:cursor-not-allowed",
  danger:
    "bg-[#FBE4E1] text-[#A12D22] border-[#FBE4E1] hover:bg-[#FBE4E1]/80 active:bg-[#FBE4E1] disabled:opacity-50 disabled:cursor-not-allowed",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-[4px]",
  sm: "h-[30px] px-3 text-[12px] font-medium gap-1.5 rounded-[6px]",
  md: "h-[34px] px-3.5 text-[13.5px] font-medium gap-2 rounded-[6px]",
  lg: "h-10 px-4 text-[14px] font-medium gap-2 rounded-[6px]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      className = "",
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center font-medium border transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] focus-visible:ring-offset-1 cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  },
);

Button.displayName = "Button";
export default Button;
