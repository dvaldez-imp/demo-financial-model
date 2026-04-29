"use client";

import { useEffect, useState } from "react";
import type { ValueOrigin } from "@/lib/types/api";

type BoardCellInputProps = {
  value: number | null;
  editable: boolean;
  valueOrigin: ValueOrigin;
  onCommit: (value: number | null) => void;
};

function formatValue(value: number | null) {
  return value === null ? "" : `${value}`;
}

function getCellClassName(valueOrigin: ValueOrigin, editable: boolean) {
  if (valueOrigin === "year_summary") {
    return "cursor-not-allowed border-transparent bg-[rgba(217,119,6,0.09)] text-[var(--warning)]";
  }

  if (valueOrigin === "forecast_generated") {
    return "cursor-not-allowed border-transparent bg-[rgba(20,89,199,0.08)] text-[var(--accent)]";
  }

  if (valueOrigin === "forecast_manual") {
    return "border-[rgba(15,159,110,0.25)] bg-[rgba(15,159,110,0.08)] text-[var(--success)]";
  }

  if (!editable) {
    return "cursor-not-allowed border-transparent bg-[var(--surface-muted)] text-[var(--foreground-muted)]";
  }

  return "border-[var(--border)] bg-white text-[var(--foreground)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";
}

export default function BoardCellInput({
  editable,
  onCommit,
  value,
  valueOrigin,
}: BoardCellInputProps) {
  const [draft, setDraft] = useState(formatValue(value));

  useEffect(() => {
    setDraft(formatValue(value));
  }, [value]);

  function commit() {
    const trimmed = draft.trim();

    if (!editable) {
      setDraft(formatValue(value));
      return;
    }

    if (!trimmed) {
      onCommit(null);
      return;
    }

    const parsed = Number(trimmed.replace(",", "."));

    if (Number.isNaN(parsed)) {
      setDraft(formatValue(value));
      return;
    }

    onCommit(parsed);
  }

  return (
    <input
      className={`numeric-cell h-10 w-full rounded-[14px] border px-3 text-right text-sm outline-none transition ${getCellClassName(
        valueOrigin,
        editable,
      )}`}
      value={draft}
      readOnly={!editable}
      title={valueOrigin}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}
