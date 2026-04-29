"use client";

import { useState } from "react";
import ArrowsRightLeftIcon from "@heroicons/react/24/outline/ArrowsRightLeftIcon";
import ChevronDownIcon from "@heroicons/react/24/outline/ChevronDownIcon";
import ChevronUpIcon from "@heroicons/react/24/outline/ChevronUpIcon";
import DocumentChartBarIcon from "@heroicons/react/24/outline/DocumentChartBarIcon";
import DocumentPlusIcon from "@heroicons/react/24/outline/DocumentPlusIcon";
import FolderIcon from "@heroicons/react/24/outline/FolderIcon";
import Squares2X2Icon from "@heroicons/react/24/outline/Squares2X2Icon";
import TableCellsIcon from "@heroicons/react/24/outline/TableCellsIcon";
import { ButtonBase, Chip, Menu, MenuItem, Typography } from "@mui/material";
import { AnimatePresence, motion } from "motion/react";
import TimelineControls from "@/components/model-board/TimelineControls";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { BoardResponse, PeriodRecord } from "@/lib/types/api";
import type { BoardBanner } from "@/lib/types/board";
import { formatPeriodShortLabel } from "@/lib/utils/periods";

type BoardHeaderProps = {
  board: BoardResponse;
  monthPeriods: PeriodRecord[];
  banner: BoardBanner | null;
  isBusy: boolean;
  isDirty: boolean;
  isCompact: boolean;
  actualsEndPeriodKey: string;
  forecastEndPeriodKey: string;
  onToggleCompact: () => void;
  onOpenCreatePremise: () => void;
  onOpenCreateScenario: () => void;
  onOpenLibrary: () => void;
  onOpenOutputs: () => void;
  onOpenDependencies: () => void;
  onOpenPasteModal: () => void;
  onSave: () => void;
  onScenarioChange: (scenarioId: string) => void;
  onActualsEndChange: (periodKey: string) => void;
  onForecastEndChange: (periodKey: string) => void;
};

const MotionDiv = motion.div;

export default function BoardHeader({
  actualsEndPeriodKey,
  banner,
  board,
  forecastEndPeriodKey,
  isBusy,
  isCompact,
  isDirty,
  monthPeriods,
  onActualsEndChange,
  onForecastEndChange,
  onOpenCreatePremise,
  onOpenCreateScenario,
  onOpenDependencies,
  onOpenLibrary,
  onOpenOutputs,
  onOpenPasteModal,
  onSave,
  onScenarioChange,
  onToggleCompact,
}: BoardHeaderProps) {
  const [scenarioMenuAnchor, setScenarioMenuAnchor] =
    useState<HTMLElement | null>(null);
  const bannerToneClass =
    banner?.tone === "error"
      ? "bg-[rgba(183,20,20,0.08)] text-[var(--danger)]"
      : banner?.tone === "success"
        ? "bg-[rgba(5,165,60,0.08)] text-[var(--success)]"
        : "bg-[var(--accent-soft)] text-[var(--accent)]";
  const currentScenario =
    board.scenarios.find(
      (scenario) => scenario.id === board.selected_scenario_id,
    )?.name || "Base";

  return (
    <header className="panel-surface rounded-[24px] p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">Modelo</Badge>
              <Badge tone="accent">{board.model.frequency}</Badge>
              <Badge tone={isDirty ? "warning" : "success"}>
                {isDirty ? "Cambios pendientes" : "Sin cambios"}
              </Badge>
            </div>

            <h1 className="mt-3 text-[30px] font-bold leading-tight text-[var(--heading)]">
              {board.model.name}
            </h1>

            <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
              Escenario {currentScenario} | Historico{" "}
              {formatPeriodShortLabel(actualsEndPeriodKey)} | Proyeccion{" "}
              {formatPeriodShortLabel(forecastEndPeriodKey)}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
            <ButtonBase
              aria-label="Cambiar escenario"
              onClick={(event) => setScenarioMenuAnchor(event.currentTarget)}
              disabled={isBusy}
              sx={{
                border: "1px solid var(--border)",
                borderRadius: "14px",
                px: 1.5,
                py: 1,
                color: "var(--accent)",
                gap: 0.75,
                fontWeight: 600,
                minHeight: 44,
                minWidth: 220,
                justifyContent: "space-between",
                whiteSpace: "nowrap",
              }}
            >
              <span className="text-sm">Escenario: {currentScenario}</span>
              <ChevronDownIcon className="h-4 w-4" />
            </ButtonBase>

            <Menu
              anchorEl={scenarioMenuAnchor}
              open={Boolean(scenarioMenuAnchor)}
              onClose={() => setScenarioMenuAnchor(null)}
              slotProps={{
                paper: {
                  sx: {
                    mt: 1,
                    minWidth: 280,
                    borderRadius: 2,
                    border: "1px solid var(--border)",
                    boxShadow: "0 16px 36px rgba(21,21,21,0.08)",
                  },
                },
              }}
            >
              {board.scenarios.map((scenario) => (
                <MenuItem
                  key={scenario.id}
                  selected={scenario.id === board.selected_scenario_id}
                  onClick={() => {
                    setScenarioMenuAnchor(null);
                    onScenarioChange(scenario.id);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Typography sx={{ fontWeight: 600 }}>
                      {scenario.name}
                    </Typography>
                    {scenario.id === board.selected_scenario_id ? (
                      <Chip
                        label="Activo"
                        size="small"
                        sx={{
                          borderRadius: "10px",
                          backgroundColor: "rgba(0, 56, 101, 0.08)",
                          color: "var(--accent)",
                          fontWeight: 700,
                        }}
                      />
                    ) : null}
                  </div>
                </MenuItem>
              ))}
            </Menu>

            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<DocumentPlusIcon className="h-4 w-4" />}
              onClick={onOpenCreatePremise}
            >
              Agregar premisa
            </Button>
            <Button
              size="sm"
              leadingIcon={<Squares2X2Icon className="h-4 w-4" />}
              onClick={onSave}
              disabled={!isDirty || isBusy}
            >
              Guardar
            </Button>
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 rounded-[14px] border border-[var(--border)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              aria-expanded={!isCompact}
              onClick={onToggleCompact}
            >
              {isCompact ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronUpIcon className="h-4 w-4" />
              )}
              {isCompact ? "Expandir header" : "Minimizar header"}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {!isCompact ? (
            <MotionDiv
              key="board-header-expanded"
              initial={{ opacity: 0, height: 0, y: -8 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="grid gap-4 border-t border-[var(--border)] pt-4 xl:grid-cols-[minmax(0,1fr)_auto]">
                <div className="space-y-4">
                  <p className="max-w-3xl text-sm leading-6 text-[var(--foreground-muted)]">
                    Ajusta timeline, escenario y acciones auxiliares sin dejar
                    que el header se coma el espacio util del board.
                  </p>

                  <TimelineControls
                    monthPeriods={monthPeriods}
                    actualsEndPeriodKey={actualsEndPeriodKey}
                    forecastEndPeriodKey={forecastEndPeriodKey}
                    disabled={isBusy}
                    onChangeActualsEnd={onActualsEndChange}
                    onChangeForecastEnd={onForecastEndChange}
                  />
                </div>

                <div className="grid content-start gap-2 xl:min-w-[300px]">
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<TableCellsIcon className="h-4 w-4" />}
                    onClick={onOpenPasteModal}
                  >
                    Pegar desde Excel
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<ArrowsRightLeftIcon className="h-4 w-4" />}
                    onClick={onOpenCreateScenario}
                  >
                    Crear escenario
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<FolderIcon className="h-4 w-4" />}
                    onClick={onOpenLibrary}
                  >
                    Ir a biblioteca
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<DocumentChartBarIcon className="h-4 w-4" />}
                    onClick={onOpenOutputs}
                  >
                    Ir a outputs
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Squares2X2Icon className="h-4 w-4" />}
                    onClick={onOpenDependencies}
                  >
                    Ver dependencias
                  </Button>
                </div>
              </div>
            </MotionDiv>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {banner ? (
            <MotionDiv
              key={banner.message}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={`rounded-[16px] px-4 py-3 text-sm font-medium ${bannerToneClass}`}
            >
              {banner.message}
            </MotionDiv>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}
