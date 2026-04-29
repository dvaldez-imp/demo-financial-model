"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BoardRow from "@/components/model-board/BoardRow";
import type {
  BoardPremise,
  PeriodRecord,
  YearGroupRecord,
} from "@/lib/types/api";
import { deriveYearGroups, getPeriodVisualLabel } from "@/lib/utils/periods";

type BoardGridProps = {
  periods: PeriodRecord[];
  yearGroups?: YearGroupRecord[];
  premises: BoardPremise[];
  selectedPremiseId: string | null;
  onSelectPremise: (premiseId: string) => void;
  onEditPremise: (premiseId: string) => void;
  onCellCommit: (
    premiseId: string,
    periodKey: string,
    value: number | null,
  ) => void;
  onDeletePremise: (premise: BoardPremise) => void;
};

const COLLAPSE_ANIMATION_MS = 220;

export default function BoardGrid({
  onCellCommit,
  onDeletePremise,
  onEditPremise,
  onSelectPremise,
  periods,
  premises,
  selectedPremiseId,
  yearGroups,
}: BoardGridProps) {
  const computedYearGroups = useMemo(
    () =>
      yearGroups && yearGroups.length > 0
        ? yearGroups
        : deriveYearGroups(periods),
    [periods, yearGroups],
  );
  const [collapsedYears, setCollapsedYears] = useState<Record<number, boolean>>(
    {},
  );
  const [collapsingYears, setCollapsingYears] = useState<
    Record<number, boolean>
  >({});
  const [expandingYears, setExpandingYears] = useState<Record<number, boolean>>(
    {},
  );
  const collapseTimeoutsRef = useRef<
    Record<number, ReturnType<typeof setTimeout>>
  >({});
  const expandTimeoutsRef = useRef<
    Record<number, ReturnType<typeof setTimeout>>
  >({});
  const viewportRef = useRef<HTMLDivElement>(null);
  const summaryHeaderRefs = useRef<Record<string, HTMLTableCellElement | null>>(
    {},
  );

  const periodByKey = useMemo(
    () => new Map(periods.map((period) => [period.key, period])),
    [periods],
  );

  const defaultCollapsedYears = useMemo(() => {
    const next: Record<number, boolean> = {};

    computedYearGroups.forEach((group) => {
      const hasAnyForecastMonth = group.month_period_keys.some((periodKey) => {
        const period = periodByKey.get(periodKey);
        return period?.type === "month" && period.zone === "forecast";
      });

      next[group.year] = !hasAnyForecastMonth;
    });

    return next;
  }, [computedYearGroups, periodByKey]);

  useEffect(() => {
    setCollapsedYears(defaultCollapsedYears);
    setCollapsingYears({});
    setExpandingYears({});
  }, [defaultCollapsedYears]);

  useEffect(() => {
    const collapseTimeouts = collapseTimeoutsRef.current;
    const expandTimeouts = expandTimeoutsRef.current;

    return () => {
      Object.values(collapseTimeouts).forEach((timeoutId) =>
        clearTimeout(timeoutId),
      );
      Object.values(expandTimeouts).forEach((timeoutId) =>
        clearTimeout(timeoutId),
      );
    };
  }, []);

  const visiblePeriods = useMemo(
    () =>
      periods.filter((period) => {
        if (period.type === "year_summary") {
          return true;
        }

        if (period.type !== "month") {
          return true;
        }

        return (
          !collapsedYears[period.year] ||
          Boolean(collapsingYears[period.year]) ||
          Boolean(expandingYears[period.year])
        );
      }),
    [collapsedYears, collapsingYears, expandingYears, periods],
  );

  const orderedPeriods = useMemo(() => {
    const periodMap = new Map(
      visiblePeriods.map((period) => [period.key, period]),
    );
    const ordered: PeriodRecord[] = [];
    const usedKeys = new Set<string>();

    computedYearGroups
      .slice()
      .sort((left, right) => left.year - right.year)
      .forEach((group) => {
        group.month_period_keys.forEach((key) => {
          const period = periodMap.get(key);

          if (period) {
            ordered.push(period);
            usedKeys.add(period.key);
          }
        });

        const summary = periodMap.get(group.summary_period_key);

        if (summary) {
          ordered.push(summary);
          usedKeys.add(summary.key);
        }
      });

    visiblePeriods
      .filter((period) => !usedKeys.has(period.key))
      .sort((left, right) => left.key.localeCompare(right.key))
      .forEach((period) => ordered.push(period));

    return ordered;
  }, [computedYearGroups, visiblePeriods]);

  const yearColumnSpans = computedYearGroups
    .map((group) => {
      const visibleMonthCount = orderedPeriods.filter(
        (period) => period.type === "month" && period.year === group.year,
      ).length;
      const hasSummary = orderedPeriods.some(
        (period) => period.key === group.summary_period_key,
      );

      if (!hasSummary && visibleMonthCount === 0) {
        return null;
      }

      return {
        year: group.year,
        summaryPeriodKey: group.summary_period_key,
        colSpan: visibleMonthCount + (hasSummary ? 1 : 0),
        collapsed: Boolean(collapsedYears[group.year]),
      };
    })
    .filter((entry) => entry !== null);

  function centerSummaryColumn(periodKey: string) {
    const viewport = viewportRef.current;
    const summaryCell = summaryHeaderRefs.current[periodKey];

    if (!viewport || !summaryCell) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const cellRect = summaryCell.getBoundingClientRect();
    const idealLeft =
      viewport.scrollLeft +
      (cellRect.left - viewportRect.left) -
      (viewport.clientWidth - summaryCell.clientWidth) / 2;
    const maxScrollLeft = Math.max(
      0,
      viewport.scrollWidth - viewport.clientWidth,
    );
    const nextLeft = Math.max(0, Math.min(maxScrollLeft, idealLeft));
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    viewport.scrollTo({
      left: nextLeft,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  function scheduleExpandCleanup(year: number) {
    const timeoutId = expandTimeoutsRef.current[year];
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    expandTimeoutsRef.current[year] = setTimeout(() => {
      setExpandingYears((current) => {
        const next = { ...current };
        delete next[year];
        return next;
      });
      delete expandTimeoutsRef.current[year];
    }, COLLAPSE_ANIMATION_MS);
  }

  function toggleYear(year: number) {
    const group = computedYearGroups.find((entry) => entry.year === year);
    if (!group) {
      return;
    }

    const collapseTimeout = collapseTimeoutsRef.current[year];
    if (collapseTimeout) {
      clearTimeout(collapseTimeout);
      delete collapseTimeoutsRef.current[year];
    }

    if (collapsedYears[year]) {
      setCollapsedYears((current) => ({
        ...current,
        [year]: false,
      }));
      setExpandingYears((current) => ({
        ...current,
        [year]: true,
      }));
      scheduleExpandCleanup(year);
      requestAnimationFrame(() =>
        centerSummaryColumn(group.summary_period_key),
      );
      return;
    }

    if (collapsingYears[year]) {
      return;
    }

    setCollapsingYears((current) => ({
      ...current,
      [year]: true,
    }));

    collapseTimeoutsRef.current[year] = setTimeout(() => {
      setCollapsedYears((current) => ({
        ...current,
        [year]: true,
      }));
      setCollapsingYears((current) => {
        const next = { ...current };
        delete next[year];
        return next;
      });
      delete collapseTimeoutsRef.current[year];
      requestAnimationFrame(() =>
        centerSummaryColumn(group.summary_period_key),
      );
    }, COLLAPSE_ANIMATION_MS);
  }

  return (
    <div
      ref={viewportRef}
      className="board-grid-scroll relative isolate overflow-auto"
    >
      <table className="min-w-full border-separate border-spacing-0">
        <thead className="sticky top-0 z-40">
          <tr>
            <th
              rowSpan={2}
              className="sticky left-0 z-50 min-w-[300px] border-b border-[var(--border)] bg-[rgb(249,250,251)] px-4 py-4 text-left"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                  Premisa
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--foreground-muted)]">
                  Nombre, origen, dependencia y rango de proyeccion
                </p>
              </div>
            </th>

            {yearColumnSpans.map((entry) => (
              <th
                key={`year-group-${entry.year}`}
                colSpan={entry.colSpan}
                onDoubleClick={() => toggleYear(entry.year)}
                className="cursor-pointer select-none border-b border-[var(--border)] bg-[rgba(0,56,101,0.04)] px-2 py-2 text-left"
                title="Doble click para colapsar o expandir meses del ano"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--heading)]">
                    {entry.year}
                  </span>
                  <span className="text-[11px] text-[var(--foreground-muted)]">
                    {entry.collapsed ? "Meses ocultos" : "Meses visibles"}
                  </span>
                </div>
              </th>
            ))}

            <th
              rowSpan={2}
              className="min-w-[240px] border-b border-[var(--border)] bg-[rgba(249,250,251,0.98)] px-3 py-4 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--heading)]">
                  Prediccion
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
                  Base y override del escenario
                </p>
              </div>
            </th>
          </tr>

          <tr>
            {orderedPeriods.map((period) => {
              const visual = getPeriodVisualLabel(period);
              const isCollapsing =
                period.type === "month" &&
                Boolean(collapsingYears[period.year]);
              const isExpanding =
                period.type === "month" && Boolean(expandingYears[period.year]);

              return (
                <th
                  key={period.key}
                  ref={(node) => {
                    if (period.type === "year_summary") {
                      summaryHeaderRefs.current[period.key] = node;
                    }
                  }}
                  data-summary-period-key={
                    period.type === "year_summary" ? period.key : undefined
                  }
                  onDoubleClick={() => toggleYear(period.year)}
                  className={`min-w-[118px] border-b border-[var(--border)] px-2 py-3 text-left ${
                    period.zone === "historical"
                      ? "bg-[rgba(249,250,251,0.98)]"
                      : period.zone === "forecast"
                        ? "bg-[rgba(0,56,101,0.04)]"
                        : "bg-[rgba(255,172,18,0.07)]"
                  } ${
                    period.type === "year_summary"
                      ? "cursor-pointer select-none"
                      : "cursor-default"
                  } ${
                    isCollapsing
                      ? "animate-board-year-collapse"
                      : isExpanding
                        ? "animate-board-year-expand"
                        : ""
                  }`}
                  title={`${period.label} · Doble click para colapsar o expandir ${period.year}`}
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {visual.primary}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
                      {visual.secondary}
                    </p>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {premises.map((premise) => (
            <BoardRow
              key={premise.id}
              premise={premise}
              periods={orderedPeriods}
              collapsingYears={collapsingYears}
              expandingYears={expandingYears}
              selected={selectedPremiseId === premise.id}
              onSelect={() => onSelectPremise(premise.id)}
              onEdit={() => onEditPremise(premise.id)}
              onDelete={() => onDeletePremise(premise)}
              onCellCommit={(periodKey, value) =>
                onCellCommit(premise.id, periodKey, value)
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
