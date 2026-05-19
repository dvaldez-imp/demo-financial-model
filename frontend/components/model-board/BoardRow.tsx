"use client";

import BoardCellInput from "@/components/model-board/BoardCellInput";
import PremiseSourceBadge from "@/components/model-board/PremiseSourceBadge";
import ValueOriginBadge from "@/components/model-board/ValueOriginBadge";
import { Badge } from "@/components/ui/Badge";
import type {
  BoardPremise,
  BoardValue,
  PeriodRecord,
  PredictionConfig,
  PredictionConfigOut,
  ValueOrigin,
} from "@/lib/types/api";
import {
  buildPredictionSummary,
  formatPeriodShortLabel,
} from "@/lib/utils/periods";

type BoardRowProps = {
  periods: PeriodRecord[];
  collapsingYears: Record<number, boolean>;
  expandingYears: Record<number, boolean>;
  premise: BoardPremise;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCellCommit: (periodKey: string, value: number | null) => void;
};

function buildFallbackCell(
  period: PeriodRecord,
  prediction: PredictionConfig | PredictionConfigOut,
): BoardValue | null {
  if (period.type !== "month" || period.zone !== "forecast") {
    return null;
  }

  if (prediction.method !== "manual") {
    return null;
  }

  return {
    period_key: period.key,
    value: null,
    value_origin: "forecast_manual",
    value_origin_label: "Forecast manual",
    editable: true,
  };
}

function getPredictionBadge(
  prediction: PredictionConfig | PredictionConfigOut,
  hasNonDefaultMode: boolean,
): { origin: ValueOrigin; label: string } {
  if (prediction.method === "manual") {
    return {
      origin: "forecast_manual",
      label: hasNonDefaultMode ? "Modo manual" : "Manual editable",
    };
  }

  if (hasNonDefaultMode) {
    return { origin: "forecast_generated", label: "Modo activo" };
  }

  return { origin: "forecast_generated", label: "Base automatica" };
}

export default function BoardRow({
  collapsingYears,
  expandingYears,
  onCellCommit,
  onDelete,
  onEdit,
  onSelect,
  periods,
  premise,
  selected,
}: BoardRowProps) {
  const valueMap = new Map(
    premise.values.map((entry) => [entry.period_key, entry]),
  );

  const allModes = [...premise.modes, ...premise.composite_modes];
  const defaultMode = allModes.find((m) => m.is_default);
  const activeMode = allModes.find((m) => m.id === premise.active_mode_id);
  const hasNonDefaultMode = Boolean(
    activeMode && defaultMode && activeMode.id !== defaultMode.id,
  );

  const activePrediction = premise.prediction_base;
  const predictionBadge = getPredictionBadge(activePrediction, hasNonDefaultMode);

  return (
    <tr className="align-top">
      <td
        className={`sticky left-0 z-20 min-w-75 border-b border-r border-(--border) px-4 py-4 shadow-[8px_0_12px_-10px_rgba(15,23,42,0.28)] ${
          selected ? "bg-[rgb(235,243,255)]" : "bg-white"
        }`}
      >
        <div className="w-full text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="cursor-pointer select-none text-left text-sm font-semibold text-foreground"
                  onClick={onSelect}
                  title="Seleccionar premisa"
                >
                  {premise.name}
                </button>
                <PremiseSourceBadge
                  source={premise.source}
                  label={premise.source_label}
                />
              </div>
              <p className="text-xs leading-5 text-(--foreground-muted)">
                {premise.category || "Sin categoria"}
                {premise.unit ? ` / ${premise.unit}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {hasNonDefaultMode ? (
                  <Badge tone="accent">↪ {activeMode!.name}</Badge>
                ) : activeMode ? (
                  <Badge tone="neutral">{activeMode.name}</Badge>
                ) : null}
                <Badge tone="warning">
                  {premise.year_summary_method_label}
                </Badge>
                <span className="text-xs text-(--foreground-muted)">
                  {premise.dependency_label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-xl border border-(--border) bg-(--surface-muted) px-3 py-2 text-sm font-medium text-(--foreground-muted) transition hover:border-(--accent) hover:text-(--accent)"
                onClick={onEdit}
              >
                Editar
              </button>
              <button
                type="button"
                className="rounded-xl border border-[rgba(183,20,20,0.14)] bg-[rgba(209,67,67,0.08)] px-3 py-2 text-sm font-medium text-(--danger) transition hover:border-(--danger)"
                onClick={onDelete}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </td>

      {periods.map((period) => {
        const cell =
          valueMap.get(period.key) ||
          buildFallbackCell(period, activePrediction);
        const isAnimatingCollapse =
          period.type === "month" && Boolean(collapsingYears[period.year]);
        const isAnimatingExpand =
          period.type === "month" && Boolean(expandingYears[period.year]);

        return (
          <td
            key={`${premise.id}-${period.key}`}
            className={`min-w-31.5 border-b border-(--border) px-2 py-3 ${
              period.zone === "historical"
                ? "bg-transparent"
                : period.zone === "forecast"
                  ? "bg-[rgba(20,89,199,0.03)]"
                  : "bg-[rgba(217,119,6,0.03)]"
            } ${
              isAnimatingCollapse
                ? "animate-board-year-collapse"
                : isAnimatingExpand
                  ? "animate-board-year-expand"
                  : ""
            }`}
          >
            <BoardCellInput
              value={cell?.value ?? null}
              editable={Boolean(cell?.editable)}
              valueOrigin={cell?.value_origin || "actual"}
              onCommit={(value) => onCellCommit(period.key, value)}
            />
          </td>
        );
      })}

      <td className="min-w-62.5 border-b border-(--border) px-3 py-3">
        <button
          type="button"
          className={`w-full rounded-[18px] border p-3 text-left transition ${
            selected
              ? "border-[rgba(20,89,199,0.22)] bg-[rgba(20,89,199,0.06)]"
              : "border-(--border) bg-(--surface-muted) hover:border-(--border-strong)"
          }`}
          onClick={onSelect}
        >
          <div className="flex flex-wrap items-center gap-2">
            <ValueOriginBadge
              origin={predictionBadge.origin}
              label={predictionBadge.label}
            />
          </div>
          {hasNonDefaultMode && activeMode ? (
            <p className="mt-2 text-sm font-semibold text-(--accent)">
              {activeMode.name}
            </p>
          ) : null}
          <p className={`text-sm font-semibold text-foreground ${hasNonDefaultMode ? "mt-0.5" : "mt-3"}`}>
            {activePrediction.method_label}
          </p>
          <p className="mt-1 text-xs leading-5 text-(--foreground-muted)">
            {buildPredictionSummary(activePrediction)}
          </p>
          {activePrediction.method === "manual" ? (
            <p className="mt-2 text-xs leading-5 text-(--success)">
              Los meses en proyeccion quedan editables desde la grilla.
            </p>
          ) : null}
          <p className="mt-3 text-xs text-(--foreground-muted)">
            Rango:{" "}
            {formatPeriodShortLabel(activePrediction.forecast_start_period_key)}{" "}
            a {formatPeriodShortLabel(activePrediction.forecast_end_period_key)}
          </p>
        </button>
      </td>
    </tr>
  );
}
