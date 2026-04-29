"use client";

import { useEffect, useEffectEvent, useId, useRef } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: "md" | "lg" | "xl" | "2xl" | "4xl" | "6xl";
};

const MODAL_SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
  "2xl": "max-w-4xl",
  "4xl": "max-w-5xl",
  "6xl": "max-w-6xl",
};

export function Modal({
  children,
  description,
  onClose,
  open,
  size = "lg",
  title,
}: ModalProps) {
  const descriptionId = useId();
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const handleEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
    }
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,23,42,0.3)] p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <section
        ref={dialogRef}
        className={`card-outline subtle-ring max-h-[94vh] w-full overflow-hidden rounded-[28px] ${MODAL_SIZE_CLASS[size]}`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="border-b border-[var(--border)] px-6 py-5 sm:px-7">
          <h2
            id={titleId}
            className="text-xl font-semibold tracking-tight text-[var(--heading)]"
          >
            {title}
          </h2>
          {description ? (
            <p
              id={descriptionId}
              className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]"
            >
              {description}
            </p>
          ) : null}
        </header>
        <div className="max-h-[calc(94vh-88px)] overflow-y-auto px-6 py-5 sm:px-7">
          {children}
        </div>
      </section>
    </div>
  );
}
