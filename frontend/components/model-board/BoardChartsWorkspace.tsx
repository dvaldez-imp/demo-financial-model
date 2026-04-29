"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ArrowPathIcon from "@heroicons/react/24/outline/ArrowPathIcon";
import ChartBarSquareIcon from "@heroicons/react/24/outline/ChartBarSquareIcon";
import MagnifyingGlassIcon from "@heroicons/react/24/outline/MagnifyingGlassIcon";
import PlusIcon from "@heroicons/react/24/outline/PlusIcon";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import {
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import GridLayout, { noCompactor, type Layout } from "react-grid-layout";
import type {
  BoardPremise,
  BoardResponse,
  PeriodRecord,
} from "@/lib/types/api";
import { getMonthPeriods, toCanonicalMonthLabel } from "@/lib/utils/periods";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center text-sm text-[var(--foreground-muted)]">
      Cargando grafica...
    </div>
  ),
});

const GRID_COLUMNS = 12;
const DEFAULT_CARD_W = 6;
const DEFAULT_CARD_H = 4;
const MIN_CARD_W = 3;
const MIN_CARD_H = 2;
const DEFAULT_VISIBLE_PREMISES = 4;

type BoardChartsWorkspaceProps = {
  board: BoardResponse;
  periods: PeriodRecord[];
};

type PersistedChartsState = {
  activePremiseIds: string[];
  layout: Layout;
  labelIntervals: Record<string, number>;
};

const X_AXIS_INTERVAL_OPTIONS = [1, 2, 3, 6, 12] as const;
const LARGE_VALUE_THRESHOLD = 100;

function buildStorageKey(modelId: string, scenarioId: string) {
  return `imp.board.charts.${modelId}.${scenarioId}`;
}

function buildDefaultLayout(premiseIds: string[]): Layout {
  return premiseIds.map((premiseId, index) => ({
    i: premiseId,
    x: (index * DEFAULT_CARD_W) % GRID_COLUMNS,
    y: Math.floor((index * DEFAULT_CARD_W) / GRID_COLUMNS) * DEFAULT_CARD_H,
    w: DEFAULT_CARD_W,
    h: DEFAULT_CARD_H,
    minW: MIN_CARD_W,
    minH: MIN_CARD_H,
  }));
}

function normalizeLayout(layout: Layout, activePremiseIds: string[]): Layout {
  const byId = new Map(layout.map((item) => [item.i, item]));

  return activePremiseIds.map((premiseId, index) => {
    const existing = byId.get(premiseId);

    if (existing) {
      const nextW = Math.max(MIN_CARD_W, Math.min(GRID_COLUMNS, existing.w));
      const nextX = Math.max(0, Math.min(GRID_COLUMNS - nextW, existing.x));

      return {
        ...existing,
        x: nextX,
        w: nextW,
        minW: MIN_CARD_W,
        minH: MIN_CARD_H,
      };
    }

    return {
      i: premiseId,
      x: (index * DEFAULT_CARD_W) % GRID_COLUMNS,
      y: Math.floor((index * DEFAULT_CARD_W) / GRID_COLUMNS) * DEFAULT_CARD_H,
      w: DEFAULT_CARD_W,
      h: DEFAULT_CARD_H,
      minW: MIN_CARD_W,
      minH: MIN_CARD_H,
    };
  });
}

function shouldRebuildCrampedLayout(layout: Layout) {
  if (layout.length === 0) {
    return true;
  }

  const firstRowItems = layout.filter((item) => item.y === 0);
  if (firstRowItems.length === 0) {
    return true;
  }

  const occupiedWidth = firstRowItems.reduce((sum, item) => sum + item.w, 0);
  return occupiedWidth <= GRID_COLUMNS * 0.66;
}

function roundToTwoDecimals(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatAxisValue(value: number, hasLargeValues: boolean) {
  const maximumFractionDigits = hasLargeValues ? 2 : 4;

  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function buildChartSeries(premise: BoardPremise, periods: PeriodRecord[]) {
  const monthPeriods = getMonthPeriods(periods);
  const valueMap = new Map(
    premise.values.map((entry) => [entry.period_key, entry.value]),
  );

  const categories = monthPeriods.map((period) => {
    if (period.month === null) {
      return period.label;
    }

    return toCanonicalMonthLabel(period.year, period.month);
  });

  const historical = monthPeriods.map((period) => {
    if (period.zone !== "historical") {
      return null;
    }

    const value = valueMap.get(period.key);
    return typeof value === "number" ? value : null;
  });

  const forecast = monthPeriods.map((period) => {
    if (period.zone !== "forecast") {
      return null;
    }

    const value = valueMap.get(period.key);
    return typeof value === "number" ? value : null;
  });

  const lastHistoricalIndex = historical.reduce<number>(
    (lastIndex, value, index) => {
      return typeof value === "number" ? index : lastIndex;
    },
    -1,
  );
  const firstForecastIndex = forecast.findIndex(
    (value) => typeof value === "number",
  );

  // Connect forecast to the last historical point to avoid visual discontinuity.
  if (
    lastHistoricalIndex >= 0 &&
    firstForecastIndex >= 0 &&
    firstForecastIndex > lastHistoricalIndex
  ) {
    forecast[lastHistoricalIndex] = historical[lastHistoricalIndex];
  }

  const numericValues = [...historical, ...forecast].filter(
    (value): value is number => typeof value === "number",
  );
  const maxAbsValue = numericValues.reduce(
    (maxValue, value) => Math.max(maxValue, Math.abs(value)),
    0,
  );
  const hasLargeValues = maxAbsValue >= LARGE_VALUE_THRESHOLD;
  const applyChartRounding = (value: number | null) => {
    if (typeof value !== "number") {
      return null;
    }

    return hasLargeValues ? roundToTwoDecimals(value) : value;
  };

  return {
    categories,
    hasLargeValues,
    series: [
      {
        name: "Historico",
        data: historical.map(applyChartRounding),
      },
      {
        name: "Proyeccion",
        data: forecast.map(applyChartRounding),
      },
    ],
  };
}

function getDefaultPremiseIds(premises: BoardPremise[]) {
  return premises
    .slice(0, DEFAULT_VISIBLE_PREMISES)
    .map((premise) => premise.id);
}

export default function BoardChartsWorkspace({
  board,
  periods,
}: BoardChartsWorkspaceProps) {
  const availablePremises = board.premises;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1280);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [activePremiseIds, setActivePremiseIds] = useState<string[]>([]);
  const [layout, setLayout] = useState<Layout>([]);
  const [labelIntervals, setLabelIntervals] = useState<Record<string, number>>(
    {},
  );
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const node = containerRef.current;

    if (!node) {
      return;
    }

    const initialWidth = node.getBoundingClientRect().width;
    if (initialWidth && Number.isFinite(initialWidth)) {
      setContainerWidth(Math.max(0, Math.floor(initialWidth)));
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;

      if (nextWidth && Number.isFinite(nextWidth)) {
        setContainerWidth(Math.max(0, Math.floor(nextWidth)));
      }
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const storageKey = buildStorageKey(
      board.model.id,
      board.selected_scenario_id,
    );
    const raw = window.localStorage.getItem(storageKey);
    const defaultIds = getDefaultPremiseIds(availablePremises);

    if (!raw) {
      setActivePremiseIds(defaultIds);
      setLayout(buildDefaultLayout(defaultIds));
      setLabelIntervals(
        Object.fromEntries(defaultIds.map((premiseId) => [premiseId, 1])),
      );
      setHasHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as PersistedChartsState;
      const validIds = parsed.activePremiseIds.filter((premiseId) =>
        availablePremises.some((premise) => premise.id === premiseId),
      );
      const nextIds = validIds.length > 0 ? validIds : defaultIds;
      const normalizedPersistedLayout = normalizeLayout(
        parsed.layout || [],
        nextIds,
      );
      const nextLayout = shouldRebuildCrampedLayout(normalizedPersistedLayout)
        ? buildDefaultLayout(nextIds)
        : normalizedPersistedLayout;

      setActivePremiseIds(nextIds);
      setLayout(nextLayout);
      setLabelIntervals(() => {
        const nextIntervals: Record<string, number> = {};

        nextIds.forEach((premiseId) => {
          const savedInterval = parsed.labelIntervals?.[premiseId];
          nextIntervals[premiseId] =
            typeof savedInterval === "number" &&
            X_AXIS_INTERVAL_OPTIONS.includes(
              savedInterval as (typeof X_AXIS_INTERVAL_OPTIONS)[number],
            )
              ? savedInterval
              : 1;
        });

        return nextIntervals;
      });
    } catch {
      setActivePremiseIds(defaultIds);
      setLayout(buildDefaultLayout(defaultIds));
      setLabelIntervals(
        Object.fromEntries(defaultIds.map((premiseId) => [premiseId, 1])),
      );
    } finally {
      setHasHydrated(true);
    }
  }, [availablePremises, board.model.id, board.selected_scenario_id]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const storageKey = buildStorageKey(
      board.model.id,
      board.selected_scenario_id,
    );
    const payload: PersistedChartsState = {
      activePremiseIds,
      layout: normalizeLayout(layout, activePremiseIds),
      labelIntervals,
    };

    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [
    activePremiseIds,
    board.model.id,
    board.selected_scenario_id,
    hasHydrated,
    labelIntervals,
    layout,
  ]);

  const activePremises = useMemo(
    () =>
      activePremiseIds
        .map((premiseId) =>
          availablePremises.find((premise) => premise.id === premiseId),
        )
        .filter((premise): premise is BoardPremise => Boolean(premise)),
    [activePremiseIds, availablePremises],
  );

  const filteredPremises = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return availablePremises.filter((premise) => {
      if (activePremiseIds.includes(premise.id)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        premise.name,
        premise.category || "",
        premise.unit || "",
        premise.source_label,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [activePremiseIds, availablePremises, deferredSearch]);

  function handleAddPremise(premiseId: string) {
    setActivePremiseIds((current) => {
      if (current.includes(premiseId)) {
        return current;
      }

      const next = [...current, premiseId];
      setLayout((previous) => normalizeLayout(previous, next));
      setLabelIntervals((previous) => ({
        ...previous,
        [premiseId]: previous[premiseId] || 1,
      }));
      return next;
    });
  }

  function handleRemovePremise(premiseId: string) {
    setActivePremiseIds((current) => current.filter((id) => id !== premiseId));
    setLayout((current) => current.filter((item) => item.i !== premiseId));
    setLabelIntervals((current) => {
      const next = { ...current };
      delete next[premiseId];
      return next;
    });
  }

  function handleLabelIntervalChange(premiseId: string, interval: number) {
    setLabelIntervals((current) => ({
      ...current,
      [premiseId]: interval,
    }));
  }

  function handleResetLayout() {
    setLayout(buildDefaultLayout(activePremiseIds));
  }

  return (
    <section className="panel-surface rounded-[24px] p-4 sm:p-5">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold tracking-[0.08em] text-[var(--accent)]">
              Workspace de charts
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--heading)]">
              Vista libre para explorar premisas
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
              Arrastra, redimensiona y compara historico contra proyeccion sin
              perder ancho util del tablero.
            </p>
          </div>

          <Stack
            direction="row"
            spacing={1.5}
            useFlexGap
            sx={{ flexWrap: "wrap" }}
          >
            <Button
              variant="outlined"
              startIcon={<ArrowPathIcon className="h-4 w-4" />}
              onClick={handleResetLayout}
              disabled={activePremiseIds.length === 0}
            >
              Reset layout
            </Button>
            <Button
              variant="contained"
              startIcon={<PlusIcon className="h-4 w-4" />}
              onClick={() => setDrawerOpen(true)}
            >
              Agregar premisa
            </Button>
          </Stack>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip
            label={`${activePremiseIds.length} charts activos`}
            size="small"
            sx={{
              borderRadius: "12px",
              backgroundColor: "rgba(0, 56, 101, 0.08)",
              color: "var(--accent)",
              fontWeight: 600,
            }}
          />
          <Chip
            label={`${board.scenarios.find((scenario) => scenario.id === board.selected_scenario_id)?.name || "Base"} / escenario`}
            size="small"
            sx={{
              borderRadius: "12px",
              backgroundColor: "rgba(252, 76, 2, 0.1)",
              color: "var(--accent-secondary)",
              fontWeight: 600,
            }}
          />
        </div>
      </div>

      {activePremises.length === 0 ? (
        <div className="flex min-h-[440px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-6 py-10 text-center">
          <ChartBarSquareIcon className="h-12 w-12 text-[var(--accent)]" />
          <h3 className="mt-4 text-xl font-semibold text-[var(--heading)]">
            No hay graficas activas
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--foreground-muted)]">
            Abre el selector y agrega premisas al canvas. El layout se guarda
            por modelo y escenario en tu navegador.
          </p>
          <Button
            sx={{ mt: 2.5 }}
            variant="contained"
            onClick={() => setDrawerOpen(true)}
          >
            Abrir selector
          </Button>
        </div>
      ) : (
        <div ref={containerRef} className="mt-2 min-h-[420px] w-full">
          <GridLayout
            className="layout"
            layout={normalizeLayout(layout, activePremiseIds)}
            width={containerWidth}
            compactor={noCompactor}
            gridConfig={{
              cols: GRID_COLUMNS,
              rowHeight: 88,
              margin: [16, 16],
              containerPadding: [0, 0],
            }}
            dragConfig={{
              enabled: true,
              handle: ".chart-card-handle",
            }}
            resizeConfig={{
              enabled: true,
            }}
            onLayoutChange={(nextLayout) => setLayout(nextLayout)}
          >
            {activePremises.map((premise) => {
              const chartData = buildChartSeries(premise, periods);
              const labelInterval = labelIntervals[premise.id] || 1;
              const categoryCount = chartData.categories.length;
              const xAxisCategories = chartData.categories.map(
                (category, index) => {
                  const isLastLabel = index === categoryCount - 1;
                  return index % labelInterval === 0 || isLastLabel
                    ? category
                    : "";
                },
              );

              return (
                <div key={premise.id}>
                  <Paper
                    component="section"
                    elevation={0}
                    className="h-full border border-[var(--border)] bg-white"
                    sx={{
                      overflow: "hidden",
                      borderRadius: "20px",
                      boxShadow: "var(--shadow-card)",
                    }}
                  >
                    <div className="flex h-full flex-col">
                      <div className="chart-card-handle flex cursor-move flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-base font-semibold text-[var(--heading)]">
                              {premise.name}
                            </p>
                            {premise.unit ? (
                              <Chip
                                label={premise.unit}
                                size="small"
                                sx={{
                                  borderRadius: "10px",
                                  backgroundColor: "rgba(0,56,101,0.08)",
                                  color: "var(--accent)",
                                  fontWeight: 600,
                                }}
                              />
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                            {premise.category || "Sin categoria"} |{" "}
                            {premise.source_label}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <TextField
                            select
                            size="small"
                            label="Intervalo"
                            value={labelInterval}
                            onChange={(event) =>
                              handleLabelIntervalChange(
                                premise.id,
                                Number(event.target.value),
                              )
                            }
                            sx={{ minWidth: 132 }}
                          >
                            {X_AXIS_INTERVAL_OPTIONS.map((interval) => (
                              <MenuItem
                                key={`${premise.id}-interval-${interval}`}
                                value={interval}
                              >
                                Cada {interval} mes{interval === 1 ? "" : "es"}
                              </MenuItem>
                            ))}
                          </TextField>

                          <Tooltip title="Quitar grafica">
                            <IconButton
                              size="small"
                              onClick={() => handleRemovePremise(premise.id)}
                              aria-label={`Quitar grafica ${premise.name}`}
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </IconButton>
                          </Tooltip>
                        </div>
                      </div>

                      <div className="flex-1 px-2 pb-2 pt-1">
                        <ReactApexChart
                          key={`${premise.id}-${labelInterval}`}
                          type="line"
                          height="100%"
                          series={chartData.series}
                          options={{
                            chart: {
                              toolbar: { show: false },
                              zoom: { enabled: false },
                              animations: { enabled: true },
                              fontFamily: "var(--font-poppins), sans-serif",
                              background: "transparent",
                            },
                            stroke: {
                              curve: "smooth",
                              width: [3, 3],
                            },
                            colors: ["#003865", "#FC4C02"],
                            grid: {
                              borderColor: "#EAEAEA",
                              strokeDashArray: 3,
                            },
                            legend: {
                              position: "top",
                              horizontalAlign: "left",
                              fontSize: "12px",
                            },
                            markers: {
                              size: 0,
                              hover: { sizeOffset: 4 },
                            },
                            xaxis: {
                              categories: xAxisCategories,
                              labels: {
                                rotate: -45,
                                style: {
                                  colors: "#737373",
                                  fontSize: "11px",
                                },
                              },
                            },
                            yaxis: {
                              labels: {
                                formatter: (value) =>
                                  formatAxisValue(
                                    value,
                                    chartData.hasLargeValues,
                                  ),
                                style: {
                                  colors: "#737373",
                                  fontSize: "11px",
                                },
                              },
                            },
                            tooltip: {
                              theme: "light",
                              y: {
                                formatter: (value) =>
                                  formatAxisValue(
                                    value,
                                    chartData.hasLargeValues,
                                  ),
                              },
                            },
                            dataLabels: {
                              enabled: false,
                            },
                          }}
                        />
                      </div>
                    </div>
                  </Paper>
                </div>
              );
            })}
          </GridLayout>
        </div>
      )}

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{
          paper: {
            sx: {
              width: {
                xs: "100%",
                sm: 380,
              },
              p: 3,
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
            },
          },
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Agregar premisas
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Lleva nuevas series al canvas de charts.
              </Typography>
            </div>
            <IconButton
              onClick={() => setDrawerOpen(false)}
              aria-label="Cerrar drawer"
            >
              <XMarkIcon className="h-5 w-5" />
            </IconButton>
          </div>

          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, categoria o unidad"
            className="mt-4"
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <div className="mr-2 flex items-center">
                    <MagnifyingGlassIcon className="h-4 w-4 text-[var(--foreground-muted)]" />
                  </div>
                ),
              },
            }}
          />

          <Divider sx={{ my: 2 }} />

          <div className="grid flex-1 gap-3 overflow-auto pr-1">
            {filteredPremises.map((premise) => (
              <Paper
                key={premise.id}
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: "18px",
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>{premise.name}</Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  {premise.category || "Sin categoria"} |{" "}
                  {premise.unit || "Sin unidad"}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: "block" }}
                >
                  {premise.source_label}
                </Typography>
                <Button
                  variant="outlined"
                  sx={{ mt: 1.5 }}
                  onClick={() => handleAddPremise(premise.id)}
                >
                  Agregar al canvas
                </Button>
              </Paper>
            ))}

            {filteredPremises.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--foreground-muted)]">
                No hay mas premisas que coincidan con la busqueda.
              </div>
            ) : null}
          </div>
        </div>
      </Drawer>
    </section>
  );
}
