"use client";

import { useMemo, useState } from "react";
import type {
  BoardResponse,
  BoardValue,
  PredictionConfig,
  PredictionConfigOut,
  ValueOrigin,
} from "@/lib/types/api";
import type { BoardBanner, RailTab, TimelineDraft } from "@/lib/types/board";
import {
  getInitialTimelineFromPeriods,
  getPredictionMethodLabel,
} from "@/lib/utils/periods";

type UseBoardDraftResult = {
  board: BoardResponse;
  banner: BoardBanner | null;
  activeRailTab: RailTab;
  selectedPremiseId: string | null;
  timelineDraft: TimelineDraft;
  hasBoardChanges: boolean;
  hasTimelineChanges: boolean;
  isDirty: boolean;
  setBanner: (banner: BoardBanner | null) => void;
  resetBoard: (nextBoard: BoardResponse) => void;
  setSelectedPremiseId: (premiseId: string | null) => void;
  setActiveRailTab: (tab: RailTab) => void;
  updateTimelineDraft: (draft: Partial<TimelineDraft>) => void;
  updateCellValue: (
    premiseId: string,
    periodKey: string,
    value: number | null,
  ) => void;
  updatePremisePrediction: (
    premiseId: string,
    prediction: PredictionConfig,
    mode: "base" | "override",
  ) => void;
};

function cloneBoard(board: BoardResponse): BoardResponse {
  return {
    ...board,
    model: { ...board.model },
    periods: board.periods.map((period) => ({ ...period })),
    scenarios: board.scenarios.map((scenario) => ({ ...scenario })),
    exported_outputs: board.exported_outputs.map((output) => ({ ...output })),
    premises: board.premises.map((premise) => ({
      ...premise,
      prediction_base: {
        ...premise.prediction_base,
        params: { ...premise.prediction_base.params },
      },
      prediction_override: premise.prediction_override
        ? {
            ...premise.prediction_override,
            params: { ...premise.prediction_override.params },
          }
        : null,
      values: premise.values.map((value) => ({ ...value })),
    })),
  };
}

function createSavedBoardSnapshot(board: BoardResponse) {
  return JSON.stringify(
    board.premises.map((premise) => ({
      id: premise.id,
      values: premise.values.map((value) => ({
        period_key: value.period_key,
        value: value.value,
        editable: value.editable,
        value_origin: value.value_origin,
      })),
    })),
  );
}

function createTimelineSnapshot(draft: TimelineDraft) {
  return JSON.stringify(draft);
}

function getInitialSelectedPremiseId(board: BoardResponse) {
  return board.premises[0]?.id ?? null;
}

function getValueOriginLabel(origin: ValueOrigin) {
  if (origin === "actual") {
    return "Actual";
  }

  if (origin === "forecast_manual") {
    return "Forecast manual";
  }

  if (origin === "year_summary") {
    return "Resumen anual";
  }

  return "Forecast generado";
}

function buildBoardValue(
  periodKey: string,
  value: number | null,
  origin: ValueOrigin,
  editable: boolean,
): BoardValue {
  return {
    period_key: periodKey,
    value,
    value_origin: origin,
    value_origin_label: getValueOriginLabel(origin),
    editable,
  };
}

function getActivePrediction(
  premise: BoardResponse["premises"][number],
  mode: "base" | "override",
  nextPrediction?: PredictionConfig,
): PredictionConfig | PredictionConfigOut {
  if (mode === "override") {
    return nextPrediction || premise.prediction_override || premise.prediction_base;
  }

  return premise.prediction_override || nextPrediction || premise.prediction_base;
}

export function useBoardDraft(initialBoard: BoardResponse): UseBoardDraftResult {
  const initialTimeline = getInitialTimelineFromPeriods(initialBoard.periods);

  const [board, setBoard] = useState(() => cloneBoard(initialBoard));
  const [savedBoardSnapshot, setSavedBoardSnapshot] = useState(() =>
    createSavedBoardSnapshot(initialBoard),
  );
  const [timelineDraft, setTimelineDraft] = useState<TimelineDraft>(() => ({
    actualsEndPeriodKey:
      initialBoard.model.actuals_end_period_key ||
      initialTimeline.actualsEndPeriodKey,
    forecastEndPeriodKey:
      initialBoard.model.forecast_end_period_key ||
      initialTimeline.forecastEndPeriodKey,
  }));
  const [savedTimelineSnapshot, setSavedTimelineSnapshot] = useState(() =>
    createTimelineSnapshot({
      actualsEndPeriodKey:
        initialBoard.model.actuals_end_period_key ||
        initialTimeline.actualsEndPeriodKey,
      forecastEndPeriodKey:
        initialBoard.model.forecast_end_period_key ||
        initialTimeline.forecastEndPeriodKey,
    }),
  );
  const [selectedPremiseId, setSelectedPremiseId] = useState<string | null>(() =>
    getInitialSelectedPremiseId(initialBoard),
  );
  const [activeRailTab, setActiveRailTab] = useState<RailTab>("prediction");
  const [banner, setBanner] = useState<BoardBanner | null>(null);

  const hasBoardChanges = useMemo(
    () => createSavedBoardSnapshot(board) !== savedBoardSnapshot,
    [board, savedBoardSnapshot],
  );
  const hasTimelineChanges = useMemo(
    () => createTimelineSnapshot(timelineDraft) !== savedTimelineSnapshot,
    [savedTimelineSnapshot, timelineDraft],
  );

  function resetBoard(nextBoard: BoardResponse) {
    const nextTimeline = getInitialTimelineFromPeriods(nextBoard.periods);
    const timelineState = {
      actualsEndPeriodKey:
        nextBoard.model.actuals_end_period_key ||
        nextTimeline.actualsEndPeriodKey,
      forecastEndPeriodKey:
        nextBoard.model.forecast_end_period_key ||
        nextTimeline.forecastEndPeriodKey,
    };

    setBoard(cloneBoard(nextBoard));
    setSavedBoardSnapshot(createSavedBoardSnapshot(nextBoard));
    setTimelineDraft(timelineState);
    setSavedTimelineSnapshot(createTimelineSnapshot(timelineState));
    setSelectedPremiseId((current) =>
      nextBoard.premises.some((premise) => premise.id === current)
        ? current
        : getInitialSelectedPremiseId(nextBoard),
    );
  }

  function updateCellValue(
    premiseId: string,
    periodKey: string,
    value: number | null,
  ) {
    setBoard((current) => ({
      ...current,
      premises: current.premises.map((premise) => {
        if (premise.id !== premiseId) {
          return premise;
        }

        const currentCell = premise.values.find((cell) => cell.period_key === periodKey);

        if (currentCell) {
          return {
            ...premise,
            values: premise.values.map((cell) =>
              cell.period_key === periodKey ? { ...cell, value } : cell,
            ),
          };
        }

        const period = current.periods.find((entry) => entry.key === periodKey);

        if (!period || period.type !== "month" || period.zone !== "forecast") {
          return premise;
        }

        const activePrediction =
          premise.prediction_override || premise.prediction_base;
        const valueOrigin: ValueOrigin =
          activePrediction.method === "manual"
            ? "forecast_manual"
            : "forecast_generated";

        return {
          ...premise,
          values: [
            ...premise.values,
            buildBoardValue(
              periodKey,
              value,
              valueOrigin,
              valueOrigin === "forecast_manual",
            ),
          ],
        };
      }),
    }));
  }

  function updatePremisePrediction(
    premiseId: string,
    prediction: PredictionConfig,
    mode: "base" | "override",
  ) {
    setBoard((current) => ({
      ...current,
      premises: current.premises.map((premise) => {
        if (premise.id !== premiseId) {
          return premise;
        }

        const nextPrediction = {
          method: prediction.method,
          params: prediction.params,
          forecast_start_period_key: prediction.forecast_start_period_key ?? null,
          forecast_end_period_key: prediction.forecast_end_period_key ?? null,
        };
        const activePrediction = getActivePrediction(premise, mode, nextPrediction);
        const existingValues = new Map(
          premise.values.map((value) => [value.period_key, value]),
        );
        const nextForecastValues = current.periods
          .filter((period) => period.type === "month" && period.zone === "forecast")
          .map((period) => {
            const existing = existingValues.get(period.key);

            if (activePrediction.method === "manual") {
              return buildBoardValue(
                period.key,
                existing?.value ?? null,
                "forecast_manual",
                true,
              );
            }

            if (existing) {
              return buildBoardValue(
                period.key,
                existing.value,
                "forecast_generated",
                false,
              );
            }

            return null;
          })
          .filter((value): value is BoardValue => value !== null);
        const nextForecastMap = new Map(
          nextForecastValues.map((entry) => [entry.period_key, entry]),
        );
        const preservedValues = premise.values
          .filter((entry) => !nextForecastMap.has(entry.period_key))
          .map((entry) => ({ ...entry }));
        const nextValues = [...preservedValues, ...nextForecastValues].sort((left, right) =>
          left.period_key.localeCompare(right.period_key),
        );

        if (mode === "base") {
          return {
            ...premise,
            prediction_base: {
              ...premise.prediction_base,
              ...prediction,
              method_label: getPredictionMethodLabel(prediction.method),
            },
            values: nextValues,
          };
        }

        return {
          ...premise,
          prediction_override: {
            method_label: getPredictionMethodLabel(prediction.method),
            method: prediction.method,
            params: prediction.params,
            forecast_start_period_key: prediction.forecast_start_period_key ?? null,
            forecast_end_period_key: prediction.forecast_end_period_key ?? null,
          },
          values: nextValues,
        };
      }),
    }));
  }

  return {
    board,
    banner,
    activeRailTab,
    selectedPremiseId,
    timelineDraft,
    hasBoardChanges,
    hasTimelineChanges,
    isDirty: hasBoardChanges || hasTimelineChanges,
    setBanner,
    resetBoard,
    setSelectedPremiseId,
    setActiveRailTab,
    updateTimelineDraft: (draft) =>
      setTimelineDraft((current) => ({ ...current, ...draft })),
    updateCellValue,
    updatePremisePrediction,
  };
}
