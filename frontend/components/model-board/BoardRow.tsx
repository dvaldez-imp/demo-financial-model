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
  hasOverride: boolean,
): { origin: ValueOrigin; label: string } {
  if (prediction.method === "manual") {
    return {
      origin: "forecast_manual",
      label: hasOverride ? "Override manual" : "Manual editable",
    };
  }

  return {
    origin: "forecast_generated",
    label: hasOverride ? "Override activo" : "Base automatica",
  };
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
  const activePrediction =
    premise.prediction_override || premise.prediction_base;
  const predictionBadge = getPredictionBadge(
    activePrediction,
    Boolean(premise.prediction_override),
  );

  return (
    <tr className="align-top">
      <td
        className={`sticky left-0 z-20 min-w-[300px] border-b border-r border-[var(--border)] px-4 py-4 shadow-[8px_0_12px_-10px_rgba(15,23,42,0.28)] ${
          selected ? "bg-[rgb(235,243,255)]" : "bg-white"
        }`}
      >
        <div className="w-full text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="cursor-pointer select-none text-left text-sm font-semibold text-[var(--foreground)]"
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
              <p className="text-xs leading-5 text-[var(--foreground-muted)]">
                {premise.category || "Sin categoria"}
                {premise.unit ? ` / ${premise.unit}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={premise.prediction_override ? "success" : "neutral"}
                >
                  {premise.prediction_override
                    ? "Con override"
                    : "Sin override"}
                </Badge>
                <Badge tone="warning">
                  {premise.year_summary_method_label}
                </Badge>
                <span className="text-xs text-[var(--foreground-muted)]">
                  {premise.dependency_label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--foreground-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={onEdit}
              >
                Editar
              </button>
              <button
                type="button"
                className="rounded-[12px] border border-[rgba(183,20,20,0.14)] bg-[rgba(209,67,67,0.08)] px-3 py-2 text-sm font-medium text-[var(--danger)] transition hover:border-[var(--danger)]"
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
            className={`min-w-[126px] border-b border-[var(--border)] px-2 py-3 ${
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

      <td className="min-w-[250px] border-b border-[var(--border)] px-3 py-3">
        <button
          type="button"
          className={`w-full rounded-[18px] border p-3 text-left transition ${
            selected
              ? "border-[rgba(20,89,199,0.22)] bg-[rgba(20,89,199,0.06)]"
              : "border-[var(--border)] bg-[var(--surface-muted)] hover:border-[var(--border-strong)]"
          }`}
          onClick={onSelect}
        >
          <div className="flex flex-wrap items-center gap-2">
            <ValueOriginBadge
              origin={predictionBadge.origin}
              label={predictionBadge.label}
            />
          </div>
          <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">
            {activePrediction.method_label}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--foreground-muted)]">
            {buildPredictionSummary(activePrediction)}
          </p>
          {activePrediction.method === "manual" ? (
            <p className="mt-2 text-xs leading-5 text-[var(--success)]">
              Los meses en proyeccion quedan editables desde la grilla.
            </p>
          ) : null}
          <p className="mt-3 text-xs text-[var(--foreground-muted)]">
            Rango:{" "}
            {formatPeriodShortLabel(activePrediction.forecast_start_period_key)}{" "}
            a {formatPeriodShortLabel(activePrediction.forecast_end_period_key)}
          </p>
        </button>
      </td>
    </tr>
  );
}
