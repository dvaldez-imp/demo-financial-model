"use client";

import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

export function Select({
  children,
  className = "",
  label,
  ...props
}: SelectProps) {
  return (
    <label className="flex w-full flex-col gap-2 text-sm">
      {label ? (
        <span className="font-medium text-[var(--foreground)]">{label}</span>
      ) : null}
      <select
        className={`h-11 w-full appearance-none rounded-[14px] border border-[var(--border)] bg-white bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7.5L10 12.5L15 7.5' stroke='%23737373' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")] bg-[length:16px_16px] bg-[position:right_1rem_center] bg-no-repeat px-4 pr-11 text-[var(--foreground)] shadow-[0_6px_16px_rgba(21,21,21,0.03)] outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
