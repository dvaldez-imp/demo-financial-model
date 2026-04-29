"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ChartBarSquareIcon from "@heroicons/react/24/outline/ChartBarSquareIcon";
import ClockIcon from "@heroicons/react/24/outline/ClockIcon";
import TableCellsIcon from "@heroicons/react/24/outline/TableCellsIcon";
import { Box, Tab, Tabs } from "@mui/material";
import { AnimatePresence, motion } from "motion/react";
import ActivityLogPanel from "@/components/model-board/ActivityLogPanel";
import BoardChartsWorkspace from "@/components/model-board/BoardChartsWorkspace";
import BoardGrid from "@/components/model-board/BoardGrid";
import BoardHeader from "@/components/model-board/BoardHeader";
import PredictionConfigPanel from "@/components/model-board/PredictionConfigPanel";
import CreateScenarioModal from "@/components/modals/CreateScenarioModal";
import NewPremiseModal from "@/components/modals/NewPremiseModal";
import PasteExcelModal from "@/components/modals/PasteExcelModal";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useBoardDraft } from "@/hooks/useBoardDraft";
import { createActivityLogEntry } from "@/lib/api/activity-log";
import {
  createModelPremise,
  createModelScenario,
  deleteModelPremise,
  getModelBoard,
  getModelDependencies,
  importModelGrid,
  updateModelTimeline,
} from "@/lib/api/models";
import {
  buildScenarioOverridePayload,
  updatePremisePredictionConfig,
  updatePremiseYearSummaryConfig,
} from "@/lib/api/scenarios";
import type {
  BoardResponse,
  BoardPremise,
  DependenciesResponse,
  PredictionConfig,
} from "@/lib/types/api";
import type {
  BoardViewMode,
  NewPremiseFormValues,
  NewScenarioFormValues,
} from "@/lib/types/board";
import { serializeBoardToImportText } from "@/lib/utils/board-import";
import {
  comparePeriodKeys,
  extendPeriodsToTimeline,
  getMonthPeriods,
} from "@/lib/utils/periods";

type ModelBoardScreenProps = {
  initialBoard: BoardResponse;
  initialView: BoardViewMode;
};

const HEADER_STORAGE_PREFIX = "imp.board.header.";

const CURRENT_USER = { name: "Danval Valdez", initials: "DV", color: "#003865" } as const;

function getBaseScenarioId(board: BoardResponse) {
  return (
    board.scenarios.find((scenario) => scenario.name.toLowerCase() === "base")
      ?.id ||
    board.scenarios[0]?.id ||
    board.selected_scenario_id
  );
}

function toVariableNameFallback(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export default function ModelBoardScreen({
  initialBoard,
  initialView,
}: ModelBoardScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    banner,
    board,
    hasBoardChanges,
    hasTimelineChanges,
    isDirty,
    resetBoard,
    selectedPremiseId,
    setBanner,
    setSelectedPremiseId,
    timelineDraft,
    updateCellValue,
    updatePremisePrediction,
    updateTimelineDraft,
  } = useBoardDraft(initialBoard);
  const [viewMode, setViewMode] = useState<BoardViewMode>(initialView);
  const [isHeaderCompact, setHeaderCompact] = useState(true);
  const [isPremiseModalOpen, setPremiseModalOpen] = useState(false);
  const [isScenarioModalOpen, setScenarioModalOpen] = useState(false);
  const [isPasteModalOpen, setPasteModalOpen] = useState(false);
  const [isPredictionModalOpen, setPredictionModalOpen] = useState(false);
  const [editingPremiseId, setEditingPremiseId] = useState<string | null>(null);
  const [premisePendingDelete, setPremisePendingDelete] =
    useState<BoardPremise | null>(null);
  const [dependencyGraph, setDependencyGraph] =
    useState<DependenciesResponse | null>(null);
  const [predictionSaving, setPredictionSaving] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isActivityLogOpen, setActivityLogOpen] = useState(false);

  useEffect(() => {
    setViewMode(initialView);
  }, [initialView]);

  useEffect(() => {
    const storageKey = `${HEADER_STORAGE_PREFIX}${board.model.id}`;
    const savedState = window.localStorage.getItem(storageKey);
    setHeaderCompact(savedState !== "expanded");
  }, [board.model.id]);

  useEffect(() => {
    const storageKey = `${HEADER_STORAGE_PREFIX}${board.model.id}`;
    window.localStorage.setItem(
      storageKey,
      isHeaderCompact ? "compact" : "expanded",
    );
  }, [board.model.id, isHeaderCompact]);

  const displayPeriods = useMemo(
    () =>
      extendPeriodsToTimeline(
        board.periods,
        timelineDraft.actualsEndPeriodKey,
        timelineDraft.forecastEndPeriodKey,
      ),
    [
      board.periods,
      timelineDraft.actualsEndPeriodKey,
      timelineDraft.forecastEndPeriodKey,
    ],
  );
  const monthPeriods = useMemo(
    () => getMonthPeriods(displayPeriods),
    [displayPeriods],
  );
  const baseScenarioId = useMemo(() => getBaseScenarioId(board), [board]);
  const editingPremise =
    board.premises.find((premise) => premise.id === editingPremiseId) || null;
  const currentScenarioName =
    board.scenarios.find(
      (scenario) => scenario.id === board.selected_scenario_id,
    )?.name || "Base";
  const isBaseScenario = board.selected_scenario_id === baseScenarioId;
  const availableVariables = useMemo(
    () =>
      Array.from(
        new Set(
          board.premises
            .map(
              (premise) =>
                premise.variable_name || toVariableNameFallback(premise.name),
            )
            .filter((variable) => variable.length > 0),
        ),
      ),
    [board.premises],
  );
  const blockedFormulaPremiseIds = useMemo(() => {
    if (!editingPremise || !dependencyGraph) {
      return new Set<string>();
    }

    const adjacency = new Map<string, string[]>();

    dependencyGraph.edges.forEach((edge) => {
      const current = adjacency.get(edge.from_id) || [];
      current.push(edge.to_id);
      adjacency.set(edge.from_id, current);
    });

    const blocked = new Set<string>([editingPremise.id]);
    const queue = [editingPremise.id];

    while (queue.length > 0) {
      const current = queue.shift();

      if (!current) {
        continue;
      }

      const nextNodes = adjacency.get(current) || [];

      nextNodes.forEach((nextId) => {
        if (blocked.has(nextId)) {
          return;
        }

        blocked.add(nextId);
        queue.push(nextId);
      });
    }

    return blocked;
  }, [dependencyGraph, editingPremise]);

  const formulaCandidates = useMemo(() => {
    return board.premises.map((premise) => {
      const variableName =
        premise.variable_name || toVariableNameFallback(premise.name);
      const disabled = blockedFormulaPremiseIds.has(premise.id);

      return {
        premiseId: premise.id,
        name: premise.name,
        variableName,
        disabled,
        reason:
          editingPremise && premise.id === editingPremise.id
            ? "No puedes referenciar la misma premisa."
            : disabled
              ? "Bloqueada para evitar ciclo de dependencias."
              : undefined,
      };
    });
  }, [blockedFormulaPremiseIds, board.premises, editingPremise]);

  useEffect(() => {
    let mounted = true;

    async function loadDependencies() {
      try {
        const result = await getModelDependencies(board.model.id);

        if (!mounted) {
          return;
        }

        setDependencyGraph(result);
      } catch {
        if (mounted) {
          setDependencyGraph(null);
        }
      }
    }

    void loadDependencies();

    return () => {
      mounted = false;
    };
  }, [board.model.id, board.premises.length]);

  function alignPredictionToBoardTimeline(prediction: PredictionConfig) {
    return {
      ...prediction,
      forecast_start_period_key: timelineDraft.actualsEndPeriodKey,
      forecast_end_period_key: timelineDraft.forecastEndPeriodKey,
    } satisfies PredictionConfig;
  }

  async function refreshBoard(scenarioId?: string) {
    const nextBoard = await getModelBoard(board.model.id, scenarioId);
    resetBoard(nextBoard);

    try {
      const nextDependencies = await getModelDependencies(board.model.id);
      setDependencyGraph(nextDependencies);
    } catch {
      setDependencyGraph(null);
    }
  }

  async function runAction(action: () => Promise<void>) {
    setIsBusy(true);

    try {
      await action();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ocurrio un error inesperado.";
      setBanner({ tone: "error", message });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateModelPremise(values: NewPremiseFormValues) {
    await runAction(async () => {
      await createModelPremise(board.model.id, {
        name: values.name,
        unit: values.unit || null,
        category: values.category || null,
        prediction_base: alignPredictionToBoardTimeline(values.prediction),
      });
      void createActivityLogEntry({
        user: CURRENT_USER.name, user_initials: CURRENT_USER.initials, user_color: CURRENT_USER.color,
        action_type: "crear", target_type: "premisa",
        target_name: values.name, model_name: board.model.name,
        description: "Creó nueva premisa",
        detail: values.unit ? `Unidad: ${values.unit}${values.category ? ` · Categoría: ${values.category}` : ""}` : undefined,
      });
      await refreshBoard(board.selected_scenario_id);
      setPremiseModalOpen(false);
      setBanner({ tone: "success", message: "Premisa creada en el modelo." });
    });
  }

  async function handleScenarioChange(scenarioId: string) {
    await runAction(async () => {
      await refreshBoard(scenarioId);
      setBanner(null);
    });
  }

  async function handleCreateScenario(values: NewScenarioFormValues) {
    await runAction(async () => {
      const scenario = await createModelScenario(board.model.id, {
        name: values.name,
        description: values.description || null,
      });
      void createActivityLogEntry({
        user: CURRENT_USER.name, user_initials: CURRENT_USER.initials, user_color: CURRENT_USER.color,
        action_type: "escenario", target_type: "escenario",
        target_name: values.name, model_name: board.model.name,
        description: "Creó nuevo escenario",
        detail: values.description || undefined,
      });
      await refreshBoard(scenario.id);
      setScenarioModalOpen(false);
      setBanner({ tone: "success", message: "Escenario creado." });
    });
  }

  async function handleImportGrid(rawText: string) {
    await runAction(async () => {
      const result = await importModelGrid(board.model.id, rawText);
      void createActivityLogEntry({
        user: CURRENT_USER.name, user_initials: CURRENT_USER.initials, user_color: CURRENT_USER.color,
        action_type: "importar", target_type: "grid",
        target_name: board.model.name, model_name: board.model.name,
        description: "Importó grilla desde Excel",
        detail: `${result.created_premises.length} premisas nuevas · ${result.updated_premises.length} actualizadas`,
      });
      await refreshBoard(board.selected_scenario_id);
      setPasteModalOpen(false);
      setBanner({
        tone: "success",
        message: `Importacion completada. Nuevas: ${result.created_premises.length}. Actualizadas: ${result.updated_premises.length}.`,
      });
    });
  }

  async function handleSaveBoard() {
    await runAction(async () => {
      if (hasTimelineChanges) {
        await updateModelTimeline(board.model.id, {
          actuals_end_period_key: timelineDraft.actualsEndPeriodKey,
          forecast_end_period_key: timelineDraft.forecastEndPeriodKey,
        });
        void createActivityLogEntry({
          user: CURRENT_USER.name, user_initials: CURRENT_USER.initials, user_color: CURRENT_USER.color,
          action_type: "editar", target_type: "timeline",
          target_name: board.model.name, model_name: board.model.name,
          description: "Actualizó timeline del modelo",
          detail: `Actuals hasta ${timelineDraft.actualsEndPeriodKey} · Forecast hasta ${timelineDraft.forecastEndPeriodKey}`,
        });
      }

      if (hasBoardChanges) {
        const rawText = serializeBoardToImportText({
          ...board,
          periods: displayPeriods,
        });
        await importModelGrid(board.model.id, rawText);
        void createActivityLogEntry({
          user: CURRENT_USER.name, user_initials: CURRENT_USER.initials, user_color: CURRENT_USER.color,
          action_type: "guardar", target_type: "modelo",
          target_name: board.model.name, model_name: board.model.name,
          description: "Guardó cambios en el modelo",
        });
      } else if (!hasTimelineChanges) {
        void createActivityLogEntry({
          user: CURRENT_USER.name, user_initials: CURRENT_USER.initials, user_color: CURRENT_USER.color,
          action_type: "guardar", target_type: "modelo",
          target_name: board.model.name, model_name: board.model.name,
          description: "Guardó cambios en el modelo",
        });
      }

      await refreshBoard(board.selected_scenario_id);
      setBanner({
        tone: "success",
        message: "Modelo guardado.",
      });
    });
  }

  async function handleSavePredictionBase(prediction: PredictionConfig) {
    if (!editingPremise) {
      return;
    }

    setPredictionSaving(true);

    try {
      const alignedPrediction = alignPredictionToBoardTimeline(prediction);
      updatePremisePrediction(editingPremise.id, alignedPrediction, "base");
      await updatePremisePredictionConfig(editingPremise.id, {
        base: alignedPrediction,
      });
      await refreshBoard(board.selected_scenario_id);
      setBanner({ tone: "success", message: "Prediccion base actualizada." });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo guardar la prediccion.";
      setBanner({ tone: "error", message });
    } finally {
      setPredictionSaving(false);
    }
  }

  async function handleSavePredictionOverride(prediction: PredictionConfig) {
    if (!editingPremise || isBaseScenario) {
      return;
    }

    setPredictionSaving(true);

    try {
      const alignedPrediction = alignPredictionToBoardTimeline(prediction);
      updatePremisePrediction(editingPremise.id, alignedPrediction, "override");
      await updatePremisePredictionConfig(
        editingPremise.id,
        buildScenarioOverridePayload(
          board.selected_scenario_id,
          alignedPrediction,
        ),
      );
      await refreshBoard(board.selected_scenario_id);
      setBanner({ tone: "success", message: "Override actualizado." });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo guardar el override.";
      setBanner({ tone: "error", message });
    } finally {
      setPredictionSaving(false);
    }
  }

  async function handleClearPredictionOverride() {
    if (!editingPremise || isBaseScenario) {
      return;
    }

    setPredictionSaving(true);

    try {
      await updatePremisePredictionConfig(
        editingPremise.id,
        buildScenarioOverridePayload(board.selected_scenario_id, null),
      );
      await refreshBoard(board.selected_scenario_id);
      setBanner({ tone: "success", message: "Override limpiado." });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo limpiar el override.";
      setBanner({ tone: "error", message });
    } finally {
      setPredictionSaving(false);
    }
  }

  async function handleSaveYearSummaryMethod(
    yearSummaryMethod: "sum" | "avg" | "last_value",
  ) {
    if (!editingPremise) {
      return;
    }

    setPredictionSaving(true);

    try {
      await updatePremiseYearSummaryConfig(editingPremise.id, {
        year_summary_method: yearSummaryMethod,
      });
      await refreshBoard(board.selected_scenario_id);
      setBanner({ tone: "success", message: "Resumen anual actualizado." });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el resumen anual.";
      setBanner({ tone: "error", message });
    } finally {
      setPredictionSaving(false);
    }
  }

  async function handleDeletePremise() {
    if (!premisePendingDelete) {
      return;
    }

    await runAction(async () => {
      await deleteModelPremise(board.model.id, premisePendingDelete.id);
      void createActivityLogEntry({
        user: CURRENT_USER.name, user_initials: CURRENT_USER.initials, user_color: CURRENT_USER.color,
        action_type: "eliminar", target_type: "premisa",
        target_name: premisePendingDelete.name, model_name: board.model.name,
        description: "Eliminó premisa del modelo",
      });
      await refreshBoard(board.selected_scenario_id);
      setPremisePendingDelete(null);
      setBanner({
        tone: "success",
        message: `${premisePendingDelete.name} fue eliminada del modelo.`,
      });
    });
  }

  function handleEditPremise(premiseId: string) {
    setEditingPremiseId(premiseId);
    setPredictionModalOpen(true);
  }

  function handleViewModeChange(nextView: BoardViewMode) {
    if (nextView === viewMode) {
      return;
    }

    startTransition(() => {
      setViewMode(nextView);
    });

    const params = new URLSearchParams(window.location.search);
    params.set("view", nextView);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <>
      <BoardHeader
        board={board}
        monthPeriods={monthPeriods}
        banner={banner}
        isBusy={isBusy || predictionSaving}
        isDirty={isDirty}
        isCompact={isHeaderCompact}
        actualsEndPeriodKey={timelineDraft.actualsEndPeriodKey}
        forecastEndPeriodKey={timelineDraft.forecastEndPeriodKey}
        onToggleCompact={() => setHeaderCompact((current) => !current)}
        onOpenCreatePremise={() => setPremiseModalOpen(true)}
        onOpenCreateScenario={() => setScenarioModalOpen(true)}
        onOpenLibrary={() => router.push(`/models/${board.model.id}/library`)}
        onOpenOutputs={() => router.push(`/models/${board.model.id}/outputs`)}
        onOpenDependencies={() =>
          router.push(`/models/${board.model.id}/dependencies`)
        }
        onOpenPasteModal={() => setPasteModalOpen(true)}
        onSave={handleSaveBoard}
        onScenarioChange={handleScenarioChange}
        onActualsEndChange={(periodKey) => {
          updateTimelineDraft({
            actualsEndPeriodKey: periodKey,
            forecastEndPeriodKey:
              comparePeriodKeys(timelineDraft.forecastEndPeriodKey, periodKey) <
              0
                ? periodKey
                : timelineDraft.forecastEndPeriodKey,
          });
        }}
        onForecastEndChange={(periodKey) => {
          updateTimelineDraft({
            forecastEndPeriodKey: periodKey,
            actualsEndPeriodKey:
              comparePeriodKeys(timelineDraft.actualsEndPeriodKey, periodKey) >
              0
                ? periodKey
                : timelineDraft.actualsEndPeriodKey,
          });
        }}
      />

      <section className="mt-4">
        <Box
          className="panel-surface rounded-[22px] px-3 py-2"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Tabs
            value={viewMode}
            onChange={(_event, value: BoardViewMode) =>
              handleViewModeChange(value)
            }
            aria-label="Cambiar vista del board"
            sx={{
              minHeight: 48,
              "& .MuiTabs-indicator": {
                height: 3,
                borderRadius: 999,
                backgroundColor: "var(--accent-secondary)",
              },
            }}
          >
            <Tab
              value="table"
              icon={<TableCellsIcon className="h-4 w-4" />}
              iconPosition="start"
              label="Tabla"
              sx={{
                minHeight: 48,
                textTransform: "none",
                fontWeight: 700,
                borderRadius: "14px",
              }}
            />
            <Tab
              value="charts"
              icon={<ChartBarSquareIcon className="h-4 w-4" />}
              iconPosition="start"
              label="Charts"
              sx={{
                minHeight: 48,
                textTransform: "none",
                fontWeight: 700,
                borderRadius: "14px",
              }}
            />
          </Tabs>

          <div className="flex items-center gap-3">
            <p className="px-3 text-sm text-[var(--foreground-muted)]">
              {viewMode === "table"
                ? "Tabla editable a todo ancho"
                : "Canvas libre con charts arrastrables"}
            </p>

            <button
              onClick={() => setActivityLogOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-[14px] border px-3 py-2 text-sm font-semibold transition"
              style={{
                borderColor: isActivityLogOpen ? "var(--accent)" : "var(--border)",
                color: isActivityLogOpen ? "var(--accent)" : "var(--foreground-muted)",
                background: isActivityLogOpen ? "var(--accent-soft)" : "transparent",
              }}
              aria-pressed={isActivityLogOpen}
              aria-label="Ver registro de actividad"
            >
              <ClockIcon className="h-4 w-4" />
              Actividad
            </button>
          </div>
        </Box>
      </section>

      <AnimatePresence mode="wait" initial={false}>
        {viewMode === "table" ? (
          <motion.section
            key="board-table-view"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 panel-surface overflow-hidden rounded-[24px]"
          >
            <BoardGrid
              periods={displayPeriods}
              yearGroups={board.year_groups}
              premises={board.premises}
              selectedPremiseId={selectedPremiseId}
              onSelectPremise={setSelectedPremiseId}
              onEditPremise={handleEditPremise}
              onDeletePremise={(premise) => setPremisePendingDelete(premise)}
              onCellCommit={(premiseId, periodKey, value) =>
                updateCellValue(premiseId, periodKey, value)
              }
            />
          </motion.section>
        ) : (
          <motion.div
            key="board-charts-view"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4"
          >
            <BoardChartsWorkspace board={board} periods={displayPeriods} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isActivityLogOpen && (
          <motion.section
            key="activity-log"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "fixed",
              bottom: 16,
              left: 16,
              right: 16,
              zIndex: 40,
              boxShadow: "0 24px 64px rgba(0,56,101,0.18)",
              borderRadius: 24,
            }}
          >
            <ActivityLogPanel onClose={() => setActivityLogOpen(false)} />
          </motion.section>
        )}
      </AnimatePresence>

      <Modal
        open={isPredictionModalOpen}
        title="Editar premisa"
        description="Configura metodo de prediccion, formula y resumen anual sin perder contexto del board."
        size="6xl"
        onClose={() => {
          setPredictionModalOpen(false);
          setEditingPremiseId(null);
        }}
      >
        <PredictionConfigPanel
          key={`${editingPremise?.id || "none"}-${board.selected_scenario_id}`}
          premise={editingPremise}
          actualsEndPeriodKey={timelineDraft.actualsEndPeriodKey}
          forecastEndPeriodKey={timelineDraft.forecastEndPeriodKey}
          availableVariables={availableVariables}
          formulaCandidates={formulaCandidates}
          scenarioName={currentScenarioName}
          isBaseScenario={isBaseScenario}
          pending={predictionSaving}
          onSaveBase={handleSavePredictionBase}
          onSaveOverride={handleSavePredictionOverride}
          onSaveYearSummaryMethod={handleSaveYearSummaryMethod}
          onClearOverride={handleClearPredictionOverride}
        />
      </Modal>

      <NewPremiseModal
        contextLabel="modelo"
        open={isPremiseModalOpen}
        pending={isBusy}
        onClose={() => setPremiseModalOpen(false)}
        onSubmit={handleCreateModelPremise}
      />

      <CreateScenarioModal
        open={isScenarioModalOpen}
        pending={isBusy}
        onClose={() => setScenarioModalOpen(false)}
        onSubmit={handleCreateScenario}
      />

      <PasteExcelModal
        open={isPasteModalOpen}
        pending={isBusy}
        actualsEndPeriodKey={timelineDraft.actualsEndPeriodKey}
        forecastEndPeriodKey={timelineDraft.forecastEndPeriodKey}
        premises={board.premises}
        onClose={() => setPasteModalOpen(false)}
        onConfirm={handleImportGrid}
      />

      <Modal
        open={Boolean(premisePendingDelete)}
        title="Eliminar premisa"
        description="Si la premisa tiene dependencias activas, el backend bloqueara el borrado y mostrara el motivo."
        onClose={() => setPremisePendingDelete(null)}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[var(--foreground-muted)]">
            Vas a eliminar <strong>{premisePendingDelete?.name}</strong> del
            modelo actual.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setPremisePendingDelete(null)}
            >
              Cancelar
            </Button>
            <Button onClick={handleDeletePremise} disabled={isBusy}>
              Confirmar eliminacion
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
