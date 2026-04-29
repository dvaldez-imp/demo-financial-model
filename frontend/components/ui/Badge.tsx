import type { ReactNode } from "react";

type BadgeTone = "neutral" | "accent" | "success" | "warning";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-[var(--surface-muted)] text-[var(--foreground-muted)] border-[var(--border)]",
  accent: "bg-[var(--accent-soft)] text-[var(--accent)] border-[rgba(0,56,101,0.12)]",
  success: "bg-[rgba(5,165,60,0.12)] text-[var(--success)] border-[rgba(5,165,60,0.16)]",
  warning: "bg-[rgba(255,172,18,0.16)] text-[#9a6500] border-[rgba(255,172,18,0.18)]",
};

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-[10px] border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
