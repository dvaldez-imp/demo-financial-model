"use client";

import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
};

export function Input({ className = "", hint, label, ...props }: InputProps) {
  return (
    <label className="flex w-full flex-col gap-2 text-sm">
      {label ? <span className="font-medium text-[var(--foreground)]">{label}</span> : null}
      <input
        className={`h-11 rounded-[14px] border border-[var(--border)] bg-white px-4 text-[var(--foreground)] shadow-[0_6px_16px_rgba(21,21,21,0.03)] outline-none transition placeholder:text-[var(--foreground-muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--focus-ring)] ${className}`}
        {...props}
      />
      {hint ? <span className="text-xs text-[var(--foreground-muted)]">{hint}</span> : null}
    </label>
  );
}
