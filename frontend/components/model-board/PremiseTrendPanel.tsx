"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { BoardPremise, PeriodRecord } from "@/lib/types/api";
import { getMonthPeriods } from "@/lib/utils/periods";

type PremiseTrendPanelProps = {
  premise: BoardPremise | null;
  periods: PeriodRecord[];
};

const TARGET_Y_TICKS = 6;
const MAX_Y_TICKS = 8;

function niceStep(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const residual = value / magnitude;

  if (residual <= 1) {
    return 1 * magnitude;
  }

  if (residual <= 2) {
    return 2 * magnitude;
  }

  if (residual <= 5) {
    return 5 * magnitude;
  }

  return 10 * magnitude;
}

function computeAutoYStep(values: number[]) {
  if (values.length < 2) {
    return 1;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.abs(max - min);

  if (range === 0) {
    return niceStep(Math.max(Math.abs(max) / 4, 1));
  }

  return niceStep(range / TARGET_Y_TICKS);
}

function formatAxisValue(value: number) {
  if (Number.isInteger(value)) {
    return `${value}`;
  }

  return value
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function buildYScale(values: number[], requestedStep: number) {
  if (values.length === 0) {
    return {
      step: 1,
      yTicks: [] as number[],
      yMin: 0,
      yMax: 0,
      yRange: 1,
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    const fallbackStep = niceStep(Math.max(Math.abs(max) / 4, 1));
    const yMin = min - fallbackStep * 2;
    const yMax = max + fallbackStep * 2;
    const yTicks = Array.from({ length: 5 }, (_, index) =>
      Number((yMin + fallbackStep * index).toFixed(8)),
    );

    return {
      step: fallbackStep,
      yTicks,
      yMin,
      yMax,
      yRange: yMax - yMin || fallbackStep,
    };
  }

  let safeStep =
    Number.isFinite(requestedStep) && requestedStep > 0
      ? requestedStep
      : computeAutoYStep(values);

  let start = Math.floor(min / safeStep) * safeStep;
  let end = Math.ceil(max / safeStep) * safeStep;
  let tickCount = Math.round((end - start) / safeStep) + 1;

  while (tickCount > MAX_Y_TICKS) {
    safeStep = niceStep(safeStep * 1.5);
    start = Math.floor(min / safeStep) * safeStep;
    end = Math.ceil(max / safeStep) * safeStep;
    tickCount = Math.round((end - start) / safeStep) + 1;
  }

  const yTicks: number[] = [];
  for (let tick = start; tick <= end + safeStep * 0.5; tick += safeStep) {
    yTicks.push(Number(tick.toFixed(8)));
  }

  return {
    step: safeStep,
    yTicks,
    yMin: start,
    yMax: end,
    yRange: end - start || safeStep,
  };
}

export default function PremiseTrendPanel({
  periods,
  premise,
}: PremiseTrendPanelProps) {
  const monthPeriods = useMemo(() => getMonthPeriods(periods), [periods]);

  const trend = useMemo(() => {
    if (!premise) {
      return {
        labels: [] as string[],
        numericValues: [] as number[],
        zones: [] as Array<"historical" | "forecast">,
      };
    }

    const valueMap = new Map(
      premise.values.map((entry) => [entry.period_key, entry.value]),
    );

    const labels: string[] = [];
    const numericValues: number[] = [];
    const zones: Array<"historical" | "forecast"> = [];

    monthPeriods.forEach((period) => {
      const value = valueMap.get(period.key);

      if (typeof value === "number" && Number.isFinite(value)) {
        labels.push(period.label);
        numericValues.push(value);
        zones.push(period.zone === "historical" ? "historical" : "forecast");
      }
    });

    return { labels, numericValues, zones };
  }, [monthPeriods, premise]);

  const defaultYStep = useMemo(
    () => computeAutoYStep(trend.numericValues),
    [trend.numericValues],
  );
  const defaultXStepMonths = useMemo(() => {
    const count = trend.labels.length;

    if (count <= 12) {
      return 1;
    }

    if (count <= 24) {
      return 2;
    }

    if (count <= 48) {
      return 3;
    }

    return 6;
  }, [trend.labels.length]);
  const [yStepOverride, setYStepOverride] = useState<{
    premiseId: string | null;
    value: number;
  } | null>(null);
  const [xStepOverride, setXStepOverride] = useState<{
    premiseId: string | null;
    value: number;
  } | null>(null);
  const [zoom, setZoom] = useState(100);
  const [isExpanded, setExpanded] = useState(false);
  const canUsePortal = typeof document !== "undefined";
  const activePremiseId = premise?.id ?? null;

  const values = trend.numericValues;
  const hasSeries = values.length >= 2;
  const yStep =
    yStepOverride?.premiseId === activePremiseId
      ? yStepOverride.value
      : defaultYStep;
  const xStepMonths =
    xStepOverride?.premiseId === activePremiseId
      ? xStepOverride.value
      : defaultXStepMonths;
  const safeYStep = Number.isFinite(yStep) && yStep > 0 ? yStep : defaultYStep;
  const safeXStep =
    Number.isFinite(xStepMonths) && xStepMonths > 0
      ? xStepMonths
      : defaultXStepMonths;
  const chart = useMemo(() => {
    const width = 820;
    const height = 320;
    const padding = { top: 18, right: 16, bottom: 48, left: 56 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    if (!hasSeries) {
      return {
        width,
        height,
        padding,
        yTicks: [] as number[],
        xTickIndexes: [] as number[],
        points: "",
        pointCoords: [] as Array<{
          x: number;
          y: number;
          zone: "historical" | "forecast";
        }>,
        segments: [] as Array<{
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          zone: "historical" | "forecast";
        }>,
        yMin: 0,
        yMax: 0,
        yRange: 1,
        plotWidth,
        plotHeight,
        appliedYStep: 1,
      };
    }

    const yScale = buildYScale(values, safeYStep);

    const pointCoords = values.map((value, index) => {
      const x =
        padding.left + (index / Math.max(values.length - 1, 1)) * plotWidth;
      const y =
        padding.top +
        (1 - (value - yScale.yMin) / yScale.yRange) * plotHeight;

      return { x, y, zone: trend.zones[index] ?? "forecast" };
    });

    const points = pointCoords
      .map((value, index) => {
        return `${pointCoords[index].x},${pointCoords[index].y}`;
      })
      .join(" ");

    const segments = pointCoords.slice(1).map((point, index) => {
      const previous = pointCoords[index];
      const zone =
        point.zone === "forecast" || previous.zone === "forecast"
          ? "forecast"
          : "historical";

      return {
        x1: previous.x,
        y1: previous.y,
        x2: point.x,
        y2: point.y,
        zone,
      };
    });

    const xTickIndexes: number[] = [];
    for (let index = 0; index < values.length; index += safeXStep) {
      xTickIndexes.push(index);
    }

    if (xTickIndexes.at(-1) !== values.length - 1) {
      xTickIndexes.push(values.length - 1);
    }

    return {
      width,
      height,
      padding,
      yTicks: yScale.yTicks,
      xTickIndexes,
      points,
      pointCoords,
      segments,
      yMin: yScale.yMin,
      yMax: yScale.yMax,
      yRange: yScale.yRange,
      plotWidth,
      plotHeight,
      appliedYStep: yScale.step,
    };
  }, [hasSeries, safeXStep, safeYStep, trend.zones, values]);

  if (!premise) {
    return (
      <section className="rounded-[24px] border border-dashed border-[var(--border-strong)] bg-white p-4 text-sm text-[var(--foreground-muted)]">
        Selecciona una premisa para ver su tendencia.
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-[var(--border)] bg-white p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
        Tendencia
      </p>
      <h3 className="mt-2 text-base font-semibold text-[var(--foreground)]">
        {premise.name}
      </h3>
      <p className="mt-1 text-xs text-[var(--foreground-muted)]">
        Vista rapida de evolucion por mes. El panel queda fijo mientras haces
        scroll.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--foreground-muted)]">Salto eje Y</span>
          <input
            type="number"
            min="0.0001"
            step="any"
            className="h-9 rounded-xl border border-[var(--border)] bg-white px-2.5 outline-none"
            value={yStep}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              if (Number.isFinite(parsed) && parsed > 0) {
                setYStepOverride({ premiseId: activePremiseId, value: parsed });
              }
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--foreground-muted)]">
            Salto eje X (meses)
          </span>
          <input
            type="number"
            min="1"
            step="1"
            className="h-9 rounded-xl border border-[var(--border)] bg-white px-2.5 outline-none"
            value={xStepMonths}
            onChange={(event) => {
              const parsed = Number(event.target.value);
              if (Number.isFinite(parsed) && parsed >= 1) {
                setXStepOverride({
                  premiseId: activePremiseId,
                  value: Math.round(parsed),
                });
              }
            }}
          />
        </label>
      </div>

      <div className="mt-2 text-[11px] text-[var(--foreground-muted)]">
        Ajuste automatico actual: Y cada {formatAxisValue(chart.appliedYStep)}.
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
        <div className="mb-2 flex items-center gap-4 text-xs text-[var(--foreground-muted)]">
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-5 bg-[var(--warning)]" />
            <span>Historico</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-5 bg-[var(--accent)]" />
            <span>Proyeccion</span>
          </div>
          <button
            type="button"
            className="ml-auto rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--foreground)]"
            onClick={() => {
              setZoom(100);
              setExpanded(true);
            }}
          >
            Ver grande
          </button>
        </div>

        {hasSeries ? (
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            className="h-56 w-full"
            role="img"
            aria-label="Serie temporal de la premisa"
          >
            <rect
              x={chart.padding.left}
              y={chart.padding.top}
              width={chart.plotWidth}
              height={chart.plotHeight}
              fill="white"
              stroke="var(--border)"
            />

            {chart.yTicks.map((tick) => {
              const y =
                chart.padding.top +
                (1 - (tick - chart.yMin) / chart.yRange) * chart.plotHeight;

              return (
                <g key={`y-${tick}`}>
                  <line
                    x1={chart.padding.left}
                    y1={y}
                    x2={chart.padding.left + chart.plotWidth}
                    y2={y}
                    stroke="rgba(148,163,184,0.28)"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={chart.padding.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="var(--foreground-muted)"
                  >
                    {formatAxisValue(tick)}
                  </text>
                </g>
              );
            })}

            {chart.xTickIndexes.map((index) => {
              const x =
                chart.padding.left +
                (index / Math.max(values.length - 1, 1)) * chart.plotWidth;

              return (
                <g key={`x-${index}`}>
                  <line
                    x1={x}
                    y1={chart.padding.top}
                    x2={x}
                    y2={chart.padding.top + chart.plotHeight}
                    stroke="rgba(148,163,184,0.24)"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={x}
                    y={chart.padding.top + chart.plotHeight + 16}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--foreground-muted)"
                  >
                    {trend.labels[index]}
                  </text>
                </g>
              );
            })}

            {chart.segments.map((segment, index) => (
              <line
                key={`segment-${index}`}
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                stroke={
                  segment.zone === "historical"
                    ? "var(--warning)"
                    : "var(--accent)"
                }
                strokeWidth="2.7"
                strokeLinecap="round"
              />
            ))}

            {chart.pointCoords.map((point, index) => {
              return (
                <circle
                  key={`p-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r="2.3"
                  fill={
                    point.zone === "historical"
                      ? "var(--warning)"
                      : "var(--accent)"
                  }
                />
              );
            })}
          </svg>
        ) : (
          <div className="flex h-56 items-center justify-center text-xs text-[var(--foreground-muted)]">
            No hay datos suficientes para la grafica.
          </div>
        )}
      </div>

      {isExpanded && canUsePortal
        ? createPortal(
            <div
              className="fixed inset-0 z-[999] bg-[rgba(15,23,42,0.72)] backdrop-blur-sm"
              onClick={() => setExpanded(false)}
              role="presentation"
            >
              <section
                className="card-outline subtle-ring absolute left-1/2 top-1/2 flex h-[95vh] w-[min(95vw,1720px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-white"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={`Tendencia ampliada ${premise.name}`}
              >
                <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">
                      Tendencia ampliada / {premise.name}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                      Vista centrada, fondo opaco y zoom para inspeccionar mejor
                      la serie.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--foreground)]"
                    onClick={() => setExpanded(false)}
                  >
                    Cerrar
                  </button>
                </header>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                  <div className="space-y-3">
                    <div className="flex items-end gap-3">
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="text-[var(--foreground-muted)]">
                          Zoom
                        </span>
                        <input
                          type="range"
                          min={120}
                          max={420}
                          step={10}
                          value={zoom}
                          onChange={(event) =>
                            setZoom(Number(event.target.value))
                          }
                        />
                      </label>
                      <span className="rounded-lg bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--foreground-muted)]">
                        {zoom}%
                      </span>
                    </div>

                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                      <div className="mb-2 flex items-center gap-4 text-xs text-[var(--foreground-muted)]">
                        <div className="flex items-center gap-2">
                          <span className="h-0.5 w-5 bg-[var(--warning)]" />
                          <span>Historico</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-0.5 w-5 bg-[var(--accent)]" />
                          <span>Proyeccion</span>
                        </div>
                      </div>

                      {hasSeries ? (
                        <div className="overflow-auto">
                          <svg
                            viewBox={`0 0 ${chart.width} ${chart.height}`}
                            role="img"
                            aria-label="Serie temporal ampliada"
                            style={{
                              width: `${zoom}%`,
                              minWidth: 1500,
                              height: 760,
                            }}
                          >
                            <rect
                              x={chart.padding.left}
                              y={chart.padding.top}
                              width={chart.plotWidth}
                              height={chart.plotHeight}
                              fill="white"
                              stroke="var(--border)"
                            />

                            {chart.yTicks.map((tick) => {
                              const y =
                                chart.padding.top +
                                (1 - (tick - chart.yMin) / chart.yRange) *
                                  chart.plotHeight;

                              return (
                                <g key={`modal-y-${tick}`}>
                                  <line
                                    x1={chart.padding.left}
                                    y1={y}
                                    x2={chart.padding.left + chart.plotWidth}
                                    y2={y}
                                    stroke="rgba(148,163,184,0.28)"
                                    strokeDasharray="4 4"
                                  />
                                  <text
                                    x={chart.padding.left - 8}
                                    y={y + 4}
                                    textAnchor="end"
                                    fontSize="10"
                                    fill="var(--foreground-muted)"
                                  >
                                    {formatAxisValue(tick)}
                                  </text>
                                </g>
                              );
                            })}

                            {chart.xTickIndexes.map((index) => {
                              const x =
                                chart.padding.left +
                                (index / Math.max(values.length - 1, 1)) *
                                  chart.plotWidth;

                              return (
                                <g key={`modal-x-${index}`}>
                                  <line
                                    x1={x}
                                    y1={chart.padding.top}
                                    x2={x}
                                    y2={chart.padding.top + chart.plotHeight}
                                    stroke="rgba(148,163,184,0.24)"
                                    strokeDasharray="4 4"
                                  />
                                  <text
                                    x={x}
                                    y={
                                      chart.padding.top + chart.plotHeight + 16
                                    }
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="var(--foreground-muted)"
                                  >
                                    {trend.labels[index]}
                                  </text>
                                </g>
                              );
                            })}

                            {chart.segments.map((segment, index) => (
                              <line
                                key={`modal-segment-${index}`}
                                x1={segment.x1}
                                y1={segment.y1}
                                x2={segment.x2}
                                y2={segment.y2}
                                stroke={
                                  segment.zone === "historical"
                                    ? "var(--warning)"
                                    : "var(--accent)"
                                }
                                strokeWidth="2.7"
                                strokeLinecap="round"
                              />
                            ))}

                            {chart.pointCoords.map((point, index) => (
                              <circle
                                key={`modal-p-${index}`}
                                cx={point.x}
                                cy={point.y}
                                r="2.3"
                                fill={
                                  point.zone === "historical"
                                    ? "var(--warning)"
                                    : "var(--accent)"
                                }
                              />
                            ))}
                          </svg>
                        </div>
                      ) : (
                        <div className="flex h-56 items-center justify-center text-xs text-[var(--foreground-muted)]">
                          No hay datos suficientes para la grafica.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
