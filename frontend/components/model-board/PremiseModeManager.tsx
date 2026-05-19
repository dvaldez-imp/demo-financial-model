"use client";

import { useCallback, useEffect, useState } from "react";
import AdjustmentsHorizontalIcon from "@heroicons/react/24/outline/AdjustmentsHorizontalIcon";
import CheckIcon from "@heroicons/react/24/outline/CheckIcon";
import PencilIcon from "@heroicons/react/24/outline/PencilIcon";
import PlusIcon from "@heroicons/react/24/outline/PlusIcon";
import TrashIcon from "@heroicons/react/24/outline/TrashIcon";
import {
  createPremiseMode,
  deletePremiseMode,
  listPremiseModes,
  setDefaultPremiseMode,
  updatePremiseMode,
} from "@/lib/api/premise-modes";
import { setScenarioPremiseMode, removeScenarioPremiseMode } from "@/lib/api/scenario-modes";
import type { BoardPremise, PredictionConfig, PremiseMode } from "@/lib/types/api";

const METHOD_LABEL: Record<string, string> = {
  manual: "Manual",
  carry_forward: "Carry forward",
  growth_rate_pct: "Crecimiento %",
  moving_average: "Media móvil",
  linear_trend: "Tendencia lineal",
  seasonal_naive: "Estacional naïve",
  arima_like: "ARIMA simple",
  formula_placeholder: "Fórmula",
};

const METHOD_COLOR: Record<string, string> = {
  manual: "var(--foreground-muted)",
  carry_forward: "var(--foreground-muted)",
  growth_rate_pct: "var(--accent)",
  moving_average: "#0891b2",
  linear_trend: "#7c3aed",
  seasonal_naive: "#fc4c02",
  arima_like: "#059669",
  formula_placeholder: "#ca8a04",
};

function modeDescription(mode: PremiseMode): string {
  const m = mode.prediction_config.method;
  const p = mode.prediction_config.params ?? {};
  if (m === "growth_rate_pct") return `${p.rate ?? 0}% por mes`;
  if (m === "moving_average") return `Ventana ${p.window ?? 3} meses`;
  if (m === "linear_trend") return `${p.lookback_periods ?? 12} meses lookback`;
  if (m === "seasonal_naive") return `Estación ${p.season_length ?? 12} meses`;
  if (m === "arima_like") return `${p.lookback_periods ?? 24} meses lookback`;
  if (m === "formula_placeholder") return "Fórmula";
  return METHOD_LABEL[m] ?? m;
}

type Props = {
  premise: BoardPremise;
  scenarioId: string;
  isBaseScenario: boolean;
  editingModeId?: string | null;
  onEditConfig?: (id: string | null) => void;
  onModeChanged?: () => void;
};

export default function PremiseModeManager({
  premise,
  scenarioId,
  isBaseScenario,
  editingModeId,
  onEditConfig,
  onModeChanged,
}: Props) {
  const [modes, setModes] = useState<PremiseMode[]>(premise.modes);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const activeId = premise.active_mode_id;

  const reload = useCallback(async () => {
    const fresh = await listPremiseModes(premise.id);
    setModes(fresh);
  }, [premise.id]);

  useEffect(() => {
    setModes(premise.modes);
  }, [premise.modes]);

  if (premise.dependency_type !== "none") {
    return (
      <div className="rounded-2xl border p-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--foreground-muted)" }}>
        Los modos de premisas compuestas (que dependen de otras) se configuran desde el panel de escenarios.
      </div>
    );
  }

  async function handleAddMode() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const defaultMode = modes.find((m) => m.is_default);
      const baseConfig: PredictionConfig = defaultMode?.prediction_config ?? {
        method: "carry_forward",
        params: {},
        forecast_start_period_key: null,
        forecast_end_period_key: null,
      };
      await createPremiseMode(premise.id, { name: newName.trim(), prediction_config: baseConfig });
      await reload();
      setNewName("");
      setAdding(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleRename(modeId: string) {
    if (!editName.trim()) return;
    setLoading(true);
    try {
      await updatePremiseMode(premise.id, modeId, { name: editName.trim() });
      await reload();
      setEditingId(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSetDefault(modeId: string) {
    setLoading(true);
    try {
      await setDefaultPremiseMode(premise.id, modeId);
      await reload();
      onModeChanged?.();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(modeId: string) {
    setLoading(true);
    try {
      await deletePremiseMode(premise.id, modeId);
      await reload();
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectForScenario(modeId: string) {
    if (isBaseScenario) return;
    setLoading(true);
    try {
      if (modeId === "__default__") {
        await removeScenarioPremiseMode(scenarioId, premise.id);
      } else {
        await setScenarioPremiseMode(scenarioId, premise.id, { mode_id: modeId });
      }
      onModeChanged?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: "var(--heading)" }}>
          Modos de predicción
        </span>
        <button
          onClick={() => setAdding(true)}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition hover:opacity-80"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <PlusIcon className="h-3 w-3" />
          Nuevo modo
        </button>
      </div>

      <ul className="space-y-1.5">
        {modes.map((mode) => {
          const isActive = mode.id === activeId;
          const isDefault = mode.is_default;
          const color = METHOD_COLOR[mode.prediction_config.method] ?? "var(--foreground-muted)";
          return (
            <li
              key={mode.id}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition"
              style={{
                background: isActive ? "var(--accent-soft)" : "var(--surface-muted)",
                border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {/* Active indicator */}
              <div
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: isActive ? "var(--accent)" : "var(--border)" }}
              />

              {/* Mode info */}
              {editingId === mode.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRename(mode.id); if (e.key === "Escape") setEditingId(null); }}
                  className="flex-1 rounded border px-1.5 py-0.5 text-xs focus:outline-none"
                  style={{ borderColor: "var(--accent)", background: "var(--surface)" }}
                />
              ) : (
                <span className="flex-1 font-medium" style={{ color: isActive ? "var(--accent)" : "var(--foreground)" }}>
                  {mode.name}
                  {isDefault && (
                    <span className="ml-1 text-[10px]" style={{ color: "var(--foreground-muted)" }}>(predeterminado)</span>
                  )}
                </span>
              )}

              {/* Method badge */}
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{ color, background: `${color}18` }}
              >
                {modeDescription(mode)}
              </span>

              {/* Scenario select button */}
              {!isBaseScenario && (
                <button
                  title={isActive ? "Modo activo en este escenario" : "Activar en este escenario"}
                  onClick={() => handleSelectForScenario(isDefault && isActive ? "__default__" : mode.id)}
                  disabled={loading}
                  className="shrink-0 rounded p-0.5 transition hover:opacity-80"
                  style={{ color: isActive ? "var(--accent)" : "var(--foreground-muted)" }}
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Configure prediction */}
              <button
                title={editingModeId === mode.id ? "Cerrar configuración" : "Editar configuración de predicción"}
                onClick={() => onEditConfig?.(editingModeId === mode.id ? null : mode.id)}
                disabled={loading}
                className="shrink-0 rounded p-0.5 transition hover:opacity-70"
                style={{ color: editingModeId === mode.id ? "var(--accent)" : "var(--foreground-muted)" }}
              >
                <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
              </button>

              {/* Rename */}
              {editingId === mode.id ? (
                <button
                  onClick={() => handleRename(mode.id)}
                  disabled={loading}
                  className="shrink-0 text-[10px] font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  OK
                </button>
              ) : (
                <button
                  onClick={() => { setEditingId(mode.id); setEditName(mode.name); }}
                  disabled={loading}
                  className="shrink-0 rounded p-0.5 transition hover:opacity-70"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  <PencilIcon className="h-3 w-3" />
                </button>
              )}

              {/* Set default */}
              {!isDefault && (
                <button
                  onClick={() => handleSetDefault(mode.id)}
                  disabled={loading}
                  title="Usar como modo predeterminado"
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium transition hover:opacity-80"
                  style={{ background: "var(--surface)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
                >
                  Default
                </button>
              )}

              {/* Delete */}
              {!isDefault && (
                <button
                  onClick={() => handleDelete(mode.id)}
                  disabled={loading}
                  className="shrink-0 rounded p-0.5 transition hover:opacity-70"
                  style={{ color: "var(--danger)" }}
                >
                  <TrashIcon className="h-3 w-3" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {adding && (
        <div className="flex gap-2">
          <input
            autoFocus
            placeholder="Nombre del nuevo modo…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddMode(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
            className="flex-1 rounded-lg border px-2 py-1 text-xs focus:outline-none"
            style={{ borderColor: "var(--accent)", background: "var(--surface)", color: "var(--foreground)" }}
          />
          <button
            onClick={handleAddMode}
            disabled={loading || !newName.trim()}
            className="rounded-lg px-3 py-1 text-xs font-medium transition hover:opacity-80"
            style={{ background: "var(--accent)", color: "white" }}
          >
            Crear
          </button>
          <button
            onClick={() => { setAdding(false); setNewName(""); }}
            className="rounded-lg px-2 py-1 text-xs font-medium transition hover:opacity-70"
            style={{ color: "var(--foreground-muted)" }}
          >
            Cancelar
          </button>
        </div>
      )}

      {modes.length === 0 && !adding && (
        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
          Sin modos definidos. Los valores del escenario base se usan por defecto.
        </p>
      )}
    </div>
  );
}
