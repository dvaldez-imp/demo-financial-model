"use client";

import ChevronDownIcon from "@heroicons/react/24/outline/ChevronDownIcon";
import ChevronRightIcon from "@heroicons/react/24/outline/ChevronRightIcon";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
const CATEGORY_ANIMATION_MS = 200;

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

  // Year collapse state
  const [collapsedYears, setCollapsedYears] = useState<Record<number, boolean>>({});
  const [collapsingYears, setCollapsingYears] = useState<Record<number, boolean>>({});
  const [expandingYears, setExpandingYears] = useState<Record<number, boolean>>({});
  const collapseTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const expandTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const viewportRef = useRef<HTMLDivElement>(null);
  const summaryHeaderRefs = useRef<Record<string, HTMLTableCellElement | null>>({});

  // Category collapse + filter state
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsingCategories, setCollapsingCategories] = useState<Record<string, boolean>>({});
  const [expandingCategories, setExpandingCategories] = useState<Record<string, boolean>>({});
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const categoryCollapseTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const categoryExpandTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const groupedPremises = useMemo(() => {
    const groups = new Map<string, BoardPremise[]>();
    premises.forEach((premise) => {
      const cat = premise.category || "Sin categoria";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(premise);
    });
    return groups;
  }, [premises]);

  const categories = useMemo(() => Array.from(groupedPremises.keys()), [groupedPremises]);

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
    const catCollapseTimeouts = categoryCollapseTimeoutsRef.current;
    const catExpandTimeouts = categoryExpandTimeoutsRef.current;

    return () => {
      Object.values(collapseTimeouts).forEach(clearTimeout);
      Object.values(expandTimeouts).forEach(clearTimeout);
      Object.values(catCollapseTimeouts).forEach(clearTimeout);
      Object.values(catExpandTimeouts).forEach(clearTimeout);
    };
  }, []);

  const visiblePeriods = useMemo(
    () =>
      periods.filter((period) => {
        if (period.type === "year_summary") return true;
        if (period.type !== "month") return true;

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

      if (!hasSummary && visibleMonthCount === 0) return null;

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

    if (!viewport || !summaryCell) return;

    const viewportRect = viewport.getBoundingClientRect();
    const cellRect = summaryCell.getBoundingClientRect();
    const idealLeft =
      viewport.scrollLeft +
      (cellRect.left - viewportRect.left) -
      (viewport.clientWidth - summaryCell.clientWidth) / 2;
    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const nextLeft = Math.max(0, Math.min(maxScrollLeft, idealLeft));
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    viewport.scrollTo({ left: nextLeft, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function scheduleExpandCleanup(year: number) {
    const timeoutId = expandTimeoutsRef.current[year];
    if (timeoutId) clearTimeout(timeoutId);

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
    if (!group) return;

    const collapseTimeout = collapseTimeoutsRef.current[year];
    if (collapseTimeout) {
      clearTimeout(collapseTimeout);
      delete collapseTimeoutsRef.current[year];
    }

    if (collapsedYears[year]) {
      setCollapsedYears((current) => ({ ...current, [year]: false }));
      setExpandingYears((current) => ({ ...current, [year]: true }));
      scheduleExpandCleanup(year);
      requestAnimationFrame(() => centerSummaryColumn(group.summary_period_key));
      return;
    }

    if (collapsingYears[year]) return;

    setCollapsingYears((current) => ({ ...current, [year]: true }));

    collapseTimeoutsRef.current[year] = setTimeout(() => {
      setCollapsedYears((current) => ({ ...current, [year]: true }));
      setCollapsingYears((current) => {
        const next = { ...current };
        delete next[year];
        return next;
      });
      delete collapseTimeoutsRef.current[year];
      requestAnimationFrame(() => centerSummaryColumn(group.summary_period_key));
    }, COLLAPSE_ANIMATION_MS);
  }

  function toggleCategoryVisibility(category: string) {
    setHiddenCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function toggleCategoryCollapse(category: string) {
    const existingExpand = categoryExpandTimeoutsRef.current[category];
    if (existingExpand) {
      clearTimeout(existingExpand);
      delete categoryExpandTimeoutsRef.current[category];
    }

    const existingCollapse = categoryCollapseTimeoutsRef.current[category];
    if (existingCollapse) {
      clearTimeout(existingCollapse);
      delete categoryCollapseTimeoutsRef.current[category];
    }

    if (collapsedCategories.has(category)) {
      setCollapsedCategories((current) => {
        const next = new Set(current);
        next.delete(category);
        return next;
      });
      setExpandingCategories((current) => ({ ...current, [category]: true }));
      categoryExpandTimeoutsRef.current[category] = setTimeout(() => {
        setExpandingCategories((current) => {
          const next = { ...current };
          delete next[category];
          return next;
        });
        delete categoryExpandTimeoutsRef.current[category];
      }, CATEGORY_ANIMATION_MS);
      return;
    }

    if (collapsingCategories[category]) return;

    setCollapsingCategories((current) => ({ ...current, [category]: true }));
    categoryCollapseTimeoutsRef.current[category] = setTimeout(() => {
      setCollapsedCategories((current) => {
        const next = new Set(current);
        next.add(category);
        return next;
      });
      setCollapsingCategories((current) => {
        const next = { ...current };
        delete next[category];
        return next;
      });
      delete categoryCollapseTimeoutsRef.current[category];
    }, CATEGORY_ANIMATION_MS);
  }

  const visibleCategories = categories.filter((cat) => !hiddenCategories.has(cat));

  return (
    <div className="flex flex-col">
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-(--border) bg-white px-4 py-2.5">
          {categories.map((category) => {
            const isHidden = hiddenCategories.has(category);
            const count = groupedPremises.get(category)!.length;

            return (
              <button
                key={category}
                type="button"
                onClick={() => toggleCategoryVisibility(category)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  isHidden
                    ? "border-(--border) bg-transparent text-(--foreground-muted) opacity-50"
                    : "border-(--accent) bg-[rgba(20,89,199,0.07)] text-(--accent)"
                }`}
              >
                {category}
                <span className={`rounded-full px-1 py-0 text-[10px] ${isHidden ? "bg-(--surface-muted)" : "bg-[rgba(20,89,199,0.12)]"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={viewportRef}
        className="board-grid-scroll relative isolate overflow-auto"
      >
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-40">
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-50 min-w-75 border-b border-(--border) bg-[rgb(249,250,251)] px-4 py-4 text-left"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--foreground-muted)">
                    Premisa
                  </p>
                  <p className="mt-1 text-sm leading-6 text-(--foreground-muted)">
                    Nombre, origen, dependencia y rango de proyeccion
                  </p>
                </div>
              </th>

              {yearColumnSpans.map((entry) => (
                <th
                  key={`year-group-${entry.year}`}
                  colSpan={entry.colSpan}
                  onDoubleClick={() => toggleYear(entry.year)}
                  className="cursor-pointer select-none border-b border-(--border) bg-[rgba(0,56,101,0.04)] px-2 py-2 text-left"
                  title="Doble click para colapsar o expandir meses del ano"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-(--heading)">
                      {entry.year}
                    </span>
                    <span className="text-[11px] text-(--foreground-muted)">
                      {entry.collapsed ? "Meses ocultos" : "Meses visibles"}
                    </span>
                  </div>
                </th>
              ))}

              <th
                rowSpan={2}
                className="min-w-60 border-b border-(--border) bg-[rgba(249,250,251,0.98)] px-3 py-4 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-(--heading)">
                    Prediccion
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-(--foreground-muted)">
                    Modo activo del escenario
                  </p>
                </div>
              </th>
            </tr>

            <tr>
              {orderedPeriods.map((period) => {
                const visual = getPeriodVisualLabel(period);
                const isCollapsing =
                  period.type === "month" && Boolean(collapsingYears[period.year]);
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
                    className={`min-w-[118px] border-b border-(--border) px-2 py-3 text-left ${
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
                      <p className="text-sm font-semibold text-(--foreground)">
                        {visual.primary}
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-(--foreground-muted)">
                        {visual.secondary}
                      </p>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {visibleCategories.map((category) => {
            const categoryPremises = groupedPremises.get(category)!;
            const isCollapsed = collapsedCategories.has(category);
            const isCollapsing = Boolean(collapsingCategories[category]);
            const isExpanding = Boolean(expandingCategories[category]);
            const showRows = !isCollapsed || isCollapsing || isExpanding;

            return (
              <Fragment key={category}>
                <tbody>
                  <tr>
                    <td
                      colSpan={orderedPeriods.length + 2}
                      className="border-b border-t border-(--border) bg-[rgba(0,0,0,0.015)] px-4 py-1.5"
                    >
                      <button
                        type="button"
                        className="flex items-center gap-2 text-left"
                        onClick={() => toggleCategoryCollapse(category)}
                      >
                        {isCollapsed ? (
                          <ChevronRightIcon className="h-3 w-3 text-(--foreground-muted)" />
                        ) : (
                          <ChevronDownIcon className="h-3 w-3 text-(--foreground-muted)" />
                        )}
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--foreground-muted)">
                          {category}
                        </span>
                        <span className="rounded-full bg-(--surface-muted) px-1.5 py-0.5 text-[10px] text-(--foreground-muted)">
                          {categoryPremises.length}
                        </span>
                      </button>
                    </td>
                  </tr>
                </tbody>

                {showRows && (
                  <tbody
                    className={
                      isCollapsing
                        ? "animate-board-category-collapse"
                        : isExpanding
                          ? "animate-board-category-expand"
                          : ""
                    }
                  >
                    {categoryPremises.map((premise) => (
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
                )}
              </Fragment>
            );
          })}
        </table>
      </div>
    </div>
  );
}
