"use client";

import { useEffect, useMemo, useState } from "react";
import ClockIcon from "@heroicons/react/24/outline/ClockIcon";
import FunnelIcon from "@heroicons/react/24/outline/FunnelIcon";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import { getActivityLog } from "@/lib/api/activity-log";
import {
  ACTION_BG,
  ACTION_COLORS,
  ACTION_LABELS,
  TARGET_LABELS,
  type ActionType,
  type TargetType,
} from "@/lib/types/activity-log";
import type { ActivityLogEntryOut } from "@/lib/types/api";

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin}m`;
  if (diffHrs < 24) return `hace ${diffHrs}h`;
  if (diffDays === 1) return "ayer";
  return `hace ${diffDays}d`;
}

const ALL_OPTION = "todos";

type Props = {
  onClose: () => void;
};

export default function ActivityLogPanel({ onClose }: Props) {
  const [entries, setEntries] = useState<ActivityLogEntryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<ActionType | "todos">(ALL_OPTION);
  const [filterTarget, setFilterTarget] = useState<TargetType | "todos">(ALL_OPTION);
  const [filterModel, setFilterModel] = useState<string>(ALL_OPTION);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getActivityLog()
      .then((data) => { if (mounted) setEntries(data); })
      .catch(() => { if (mounted) setEntries([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const uniqueModels = useMemo(
    () => Array.from(new Set(entries.map((e) => e.model_name))),
    [entries],
  );

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (filterAction !== ALL_OPTION && entry.action_type !== filterAction) return false;
      if (filterTarget !== ALL_OPTION && entry.target_type !== filterTarget) return false;
      if (filterModel !== ALL_OPTION && entry.model_name !== filterModel) return false;
      return true;
    });
  }, [entries, filterAction, filterTarget, filterModel]);

  const hasActiveFilters =
    filterAction !== ALL_OPTION ||
    filterTarget !== ALL_OPTION ||
    filterModel !== ALL_OPTION;

  return (
    <div className="panel-surface rounded-3xl flex flex-col overflow-hidden" style={{ height: 340 }}>
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4" style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--heading)" }}>
            Registro de actividad
          </span>
          {!loading && (
            <span
              className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {filtered.length}
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          className="rounded-lg p-1 transition hover:bg-(--surface-muted)"
          aria-label="Cerrar historial"
        >
          <XMarkIcon className="h-4 w-4" style={{ color: "var(--foreground-muted)" }} />
        </button>
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-2 border-b"
        style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}
      >
        <FunnelIcon className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--foreground-muted)" }} />

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value as ActionType | "todos")}
          className="rounded-lg border px-2 py-1 text-xs font-medium focus:outline-none"
          style={{
            borderColor: filterAction !== ALL_OPTION ? "var(--accent)" : "var(--border)",
            color: filterAction !== ALL_OPTION ? "var(--accent)" : "var(--foreground)",
            background: filterAction !== ALL_OPTION ? "var(--accent-soft)" : "var(--surface)",
          }}
        >
          <option value={ALL_OPTION}>Acción: Todas</option>
          {(Object.keys(ACTION_LABELS) as ActionType[]).map((key) => (
            <option key={key} value={key}>
              {ACTION_LABELS[key]}
            </option>
          ))}
        </select>

        <select
          value={filterTarget}
          onChange={(e) => setFilterTarget(e.target.value as TargetType | "todos")}
          className="rounded-lg border px-2 py-1 text-xs font-medium focus:outline-none"
          style={{
            borderColor: filterTarget !== ALL_OPTION ? "var(--accent)" : "var(--border)",
            color: filterTarget !== ALL_OPTION ? "var(--accent)" : "var(--foreground)",
            background: filterTarget !== ALL_OPTION ? "var(--accent-soft)" : "var(--surface)",
          }}
        >
          <option value={ALL_OPTION}>Tipo: Todos</option>
          {(Object.keys(TARGET_LABELS) as TargetType[]).map((key) => (
            <option key={key} value={key}>
              {TARGET_LABELS[key]}
            </option>
          ))}
        </select>

        <select
          value={filterModel}
          onChange={(e) => setFilterModel(e.target.value)}
          className="rounded-lg border px-2 py-1 text-xs font-medium focus:outline-none"
          style={{
            borderColor: filterModel !== ALL_OPTION ? "var(--accent)" : "var(--border)",
            color: filterModel !== ALL_OPTION ? "var(--accent)" : "var(--foreground)",
            background: filterModel !== ALL_OPTION ? "var(--accent-soft)" : "var(--surface)",
          }}
        >
          <option value={ALL_OPTION}>Modelo: Todos</option>
          {uniqueModels.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setFilterAction(ALL_OPTION);
              setFilterTarget(ALL_OPTION);
              setFilterModel(ALL_OPTION);
            }}
            className="rounded-lg px-2 py-1 text-xs font-medium transition hover:opacity-80"
            style={{ color: "var(--danger)", background: "rgba(183,20,20,0.08)" }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
              Cargando actividad…
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
              {hasActiveFilters
                ? "No hay registros con los filtros aplicados."
                : "No hay actividad registrada."}
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {filtered.map((entry) => {
              const actionType = entry.action_type as ActionType;
              const targetType = entry.target_type as TargetType;
              return (
                <li key={entry.id} className="flex gap-3 px-4 py-3 hover:bg-(--surface-muted) transition-colors">
                  {/* User avatar */}
                  <div
                    className="shrink-0 flex items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{
                      width: 28,
                      height: 28,
                      background: entry.user_color,
                      marginTop: 1,
                    }}
                  >
                    {entry.user_initials}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span
                          className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold mr-1.5"
                          style={{
                            background: ACTION_BG[actionType] ?? "var(--surface-muted)",
                            color: ACTION_COLORS[actionType] ?? "var(--foreground)",
                          }}
                        >
                          {ACTION_LABELS[actionType] ?? actionType}
                        </span>
                        <span
                          className="text-xs font-medium"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          {TARGET_LABELS[targetType] ?? targetType}
                        </span>
                      </div>
                      <span
                        className="shrink-0 text-[10px] tabular-nums"
                        style={{ color: "var(--foreground-muted)" }}
                      >
                        {formatRelativeTime(entry.timestamp)}
                      </span>
                    </div>

                    <p className="mt-0.5 text-xs font-semibold truncate" style={{ color: "var(--foreground)" }}>
                      {entry.target_name}
                    </p>

                    <p className="text-[10px] leading-4" style={{ color: "var(--foreground-muted)" }}>
                      <span className="font-medium" style={{ color: entry.user_color }}>
                        {entry.user.split(" ")[0]}
                      </span>
                      {" · "}
                      {entry.description}
                      {entry.detail && (
                        <span className="text-[10px]"> · {entry.detail}</span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
