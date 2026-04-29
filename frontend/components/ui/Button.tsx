"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_14px_30px_rgba(0,56,101,0.16)] hover:border-[var(--accent-strong)] hover:bg-[var(--accent-strong)]",
  secondary:
    "border border-[var(--border-strong)] bg-white text-[var(--foreground)] shadow-[0_8px_20px_rgba(21,21,21,0.04)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
  ghost:
    "bg-transparent text-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]",
  danger:
    "border border-[var(--danger)] bg-[var(--danger)] text-white shadow-[0_14px_30px_rgba(183,20,20,0.2)] hover:bg-[#951010]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-10 rounded-[12px] px-3.5 text-sm",
  md: "h-11 rounded-[14px] px-4 text-sm",
};

export function Button({
  children,
  className = "",
  leadingIcon,
  size = "md",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      style={variant === "primary" || variant === "danger" ? { color: "#ffffff" } : undefined}
      {...props}
    >
      {leadingIcon ? <span className="text-base">{leadingIcon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
