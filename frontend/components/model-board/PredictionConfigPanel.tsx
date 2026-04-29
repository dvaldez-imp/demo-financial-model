"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { compileFormulaExpression } from "@/lib/utils/formula-compiler";
import type {
  BoardPremise,
  PredictionConfig,
  YearSummaryMethod,
} from "@/lib/types/api";
import {
  buildDefaultPredictionParams,
  buildPredictionSummary,
  formatPeriodShortLabel,
  getPredictionMethodLabel,
} from "@/lib/utils/periods";

type PredictionConfigFormProps = {
  title: string;
  prediction: PredictionConfig;
  actualsEndPeriodKey: string;
  forecastEndPeriodKey: string;
  knownVariables: string[];
  formulaCandidates: FormulaCandidate[];
  pending?: boolean;
  onSave: (prediction: PredictionConfig) => Promise<void> | void;
};

type FormulaCandidate = {
  premiseId: string;
  name: string;
  variableName: string;
  disabled: boolean;
  reason?: string;
};

const VARIABLE_COLOR_CLASSES = [
  "bg-[rgba(20,89,199,0.12)] text-[var(--accent)]",
  "bg-[rgba(15,159,110,0.12)] text-[var(--success)]",
  "bg-[rgba(217,119,6,0.14)] text-[var(--warning)]",
  "bg-[rgba(236,72,153,0.14)] text-[rgb(157,23,77)]",
  "bg-[rgba(8,145,178,0.14)] text-[rgb(14,116,144)]",
] as const;

const METHOD_HELP: Record<
  PredictionConfig["method"],
  { title: string; body: string; example: string }
> = {
  manual: {
    title: "Edicion manual sobre la proyeccion",
    body: "Sirve para capturar supuestos puntuales por mes. Si cambias desde crecimiento, repetir ultimo valor o formula a manual, los valores proyectados se conservan y luego los puedes editar desde la grilla.",
    example:
      "Ejemplos utiles: tipo_cambio, inflacion, ajuste extraordinario de gasolina o un caso de choque 2026.",
  },
  carry_forward: {
    title: "Continuidad operativa simple",
    body: "Repite el ultimo valor historico hacia adelante. Funciona bien cuando quieres una linea base estable antes de aplicar un escenario.",
    example:
      "Ejemplos utiles: costo de energia planta, gasto fijo recurrente, tarifa sin renegociacion.",
  },
  growth_rate_pct: {
    title: "Crecimiento compuesto",
    body: "Extiende la serie con una variacion porcentual mensual. Es util para costos o ingresos donde quieres proyectar una tendencia sin cargar una formula completa.",
    example:
      "Ejemplos utiles: precio gasolina regular, precio promedio por tonelada, volumen retail exportado.",
  },
  moving_average: {
    title: "Suavizado por promedio movil",
    body: "Proyecta usando una ventana de meses recientes para reducir ruido y estabilizar la serie antes del forecast.",
    example:
      "Ejemplos utiles: tipo_cambio, inflacion, indicadores macro con volatilidad corta.",
  },
  linear_trend: {
    title: "Tendencia lineal sobre historia",
    body: "Ajusta una tendencia con varios meses historicos y la extiende hacia adelante. Sirve cuando la serie tiene una pendiente clara.",
    example:
      "Ejemplos utiles: demanda retail, volumen exportado o capacidad utilizada.",
  },
  seasonal_naive: {
    title: "Patron estacional repetido",
    body: "Replica la estacionalidad observada en la historia reciente. Es adecuado cuando la forma del año importa más que una pendiente.",
    example:
      "Ejemplos utiles: combustible, ventas estacionales, consumo por campaña.",
  },
  arima_like: {
    title: "ARIMA simplificado",
    body: "Usa una ventana historica más larga para capturar inercia y dirección del comportamiento reciente sin llegar a un modelo estadístico pesado.",
    example:
      "Ejemplos utiles: demanda operativa, rentabilidad o series con patrón y tendencia mixta.",
  },
  formula_placeholder: {
    title: "Relacion entre premisas",
    body: "Calcula una premisa a partir de otras variables del modelo. Deja el historico como base y usa el rango de proyeccion para derivar resultados.",
    example:
      "Ejemplos utiles: ingreso_bruto = precio_promedio * demanda_importada; costo_variable = gasolina * demanda_importada + gasto_logistico + gasto_energia.",
  },
};

function getVariableColorClass(variableName: string, variables: string[]) {
  const index = variables.indexOf(variableName);
  if (index < 0) {
    return VARIABLE_COLOR_CLASSES[0];
  }

  return VARIABLE_COLOR_CLASSES[index % VARIABLE_COLOR_CLASSES.length];
}

function PredictionConfigForm({
  actualsEndPeriodKey,
  forecastEndPeriodKey,
  formulaCandidates,
  knownVariables,
  onSave,
  pending = false,
  prediction,
  title,
}: PredictionConfigFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState<PredictionConfig>({
    method: prediction.method,
    params: { ...prediction.params },
    forecast_start_period_key: actualsEndPeriodKey,
    forecast_end_period_key: forecastEndPeriodKey,
  });
  const expression = `${draft.params.expression ?? ""}`;
  const formulaCompile = useMemo(
    () =>
      draft.method === "formula_placeholder"
        ? compileFormulaExpression(expression, { knownVariables })
        : null,
    [draft.method, expression, knownVariables],
  );
  const hasFormulaErrors =
    formulaCompile?.diagnostics.some((item) => item.level === "error") || false;
  const methodHelp = METHOD_HELP[draft.method];

  function insertVariable(variableName: string) {
    const textarea = textareaRef.current;

    if (!textarea) {
      setDraft((current) => ({
        ...current,
        params: {
          expression: `${current.params.expression ?? ""}${
            current.params.expression ? " " : ""
          }${variableName}`,
        },
      }));
      return;
    }

    const currentExpression = `${draft.params.expression ?? ""}`;
    const start = textarea.selectionStart ?? currentExpression.length;
    const end = textarea.selectionEnd ?? currentExpression.length;
    const nextExpression = `${currentExpression.slice(0, start)}${variableName}${currentExpression.slice(end)}`;
    const nextCaret = start + variableName.length;

    setDraft((current) => ({
      ...current,
      params: { expression: nextExpression },
    }));

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  }

  return (
    <section className="rounded-[24px] border border-[var(--border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--foreground-muted)]">
            {buildPredictionSummary(draft)}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <Select
          label="Metodo"
          value={draft.method}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              method: event.target.value as PredictionConfig["method"],
              params: buildDefaultPredictionParams(
                event.target.value as PredictionConfig["method"],
                current.params,
              ),
            }))
          }
        >
          <option value="manual">{getPredictionMethodLabel("manual")}</option>
          <option value="carry_forward">
            {getPredictionMethodLabel("carry_forward")}
          </option>
          <option value="growth_rate_pct">
            {getPredictionMethodLabel("growth_rate_pct")}
          </option>
          <option value="moving_average">
            {getPredictionMethodLabel("moving_average")}
          </option>
          <option value="linear_trend">
            {getPredictionMethodLabel("linear_trend")}
          </option>
          <option value="seasonal_naive">
            {getPredictionMethodLabel("seasonal_naive")}
          </option>
          <option value="arima_like">
            {getPredictionMethodLabel("arima_like")}
          </option>
          <option value="formula_placeholder">
            {getPredictionMethodLabel("formula_placeholder")}
          </option>
        </Select>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
            {methodHelp.title}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
            {methodHelp.body}
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--foreground-muted)]">
            {methodHelp.example}
          </p>
        </div>

        {draft.method === "growth_rate_pct" ? (
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">
              Crecimiento % mensual
            </span>
            <input
              className="numeric-cell h-11 rounded-2xl border border-[var(--border)] bg-white px-3.5 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              type="number"
              step="0.1"
              value={`${draft.params.rate ?? 0}`}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  params: { rate: Number(event.target.value) },
                }))
              }
            />
          </label>
        ) : null}

        {draft.method === "moving_average" ? (
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">
              Ventana de promedio (meses)
            </span>
            <input
              className="numeric-cell h-11 rounded-2xl border border-[var(--border)] bg-white px-3.5 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              type="number"
              min="2"
              step="1"
              value={`${draft.params.window ?? 4}`}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  params: { window: Number(event.target.value) },
                }))
              }
            />
          </label>
        ) : null}

        {draft.method === "linear_trend" || draft.method === "arima_like" ? (
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">
              Ventana historica (meses)
            </span>
            <input
              className="numeric-cell h-11 rounded-2xl border border-[var(--border)] bg-white px-3.5 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              type="number"
              min="3"
              step="1"
              value={`${draft.params.lookback_periods ?? (draft.method === "arima_like" ? 24 : 12)}`}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  params: { lookback_periods: Number(event.target.value) },
                }))
              }
            />
          </label>
        ) : null}

        {draft.method === "seasonal_naive" ? (
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">
              Longitud estacional (meses)
            </span>
            <input
              className="numeric-cell h-11 rounded-2xl border border-[var(--border)] bg-white px-3.5 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              type="number"
              min="2"
              step="1"
              value={`${draft.params.season_length ?? 12}`}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  params: { season_length: Number(event.target.value) },
                }))
              }
            />
          </label>
        ) : null}

        {draft.method === "formula_placeholder" ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-[var(--foreground)]">
                Formula simple
              </span>
              <textarea
                ref={textareaRef}
                rows={4}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                placeholder="precio_promedio * demanda_importada"
                className={`rounded-2xl border bg-white px-3.5 py-2 font-mono text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] ${
                  hasFormulaErrors
                    ? "border-[var(--danger)]"
                    : "border-[var(--border)]"
                }`}
                value={expression}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    params: { expression: event.target.value },
                  }))
                }
              />

              {formulaCompile ? (
                <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                    Vista compilada
                  </p>
                  <div className="flex flex-wrap items-center gap-1 font-mono text-xs">
                    {formulaCompile.tokens.map((token, index) => {
                      if (token.type === "variable") {
                        const isUnknown =
                          formulaCompile.unknownVariables.includes(token.value);

                        return (
                          <span
                            key={`${token.start}-${index}`}
                            className={`rounded-md px-1.5 py-0.5 ${
                              isUnknown
                                ? "bg-[rgba(209,67,67,0.14)] text-[var(--danger)]"
                                : getVariableColorClass(
                                    token.value,
                                    formulaCompile.variables,
                                  )
                            }`}
                          >
                            {token.value}
                          </span>
                        );
                      }

                      if (token.type === "invalid") {
                        return (
                          <span
                            key={`${token.start}-${index}`}
                            className="rounded-md bg-[rgba(209,67,67,0.14)] px-1.5 py-0.5 text-[var(--danger)]"
                          >
                            {token.value}
                          </span>
                        );
                      }

                      return (
                        <span key={`${token.start}-${index}`}>
                          {token.value}
                        </span>
                      );
                    })}
                  </div>

                  {formulaCompile.diagnostics.length > 0 ? (
                    <div className="space-y-1">
                      {formulaCompile.diagnostics.map((item, index) => (
                        <p
                          key={`${item.message}-${index}`}
                          className={`text-xs ${
                            item.level === "error"
                              ? "text-[var(--danger)]"
                              : "text-[var(--warning)]"
                          }`}
                        >
                          {item.message}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--success)]">
                      Formula valida.
                    </p>
                  )}
                </div>
              ) : null}
            </label>

            <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
                Premisas usables
              </p>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                Toque una para insertar su variable.
              </p>
              <div className="mt-2 max-h-56 space-y-2 overflow-auto pr-1">
                {formulaCandidates.map((candidate) => (
                  <button
                    key={candidate.premiseId}
                    type="button"
                    disabled={candidate.disabled}
                    onClick={() => insertVariable(candidate.variableName)}
                    className={`w-full rounded-xl border px-2 py-2 text-left text-xs ${
                      candidate.disabled
                        ? "cursor-not-allowed border-[var(--border)] bg-white/70 text-[var(--foreground-muted)]"
                        : "border-[var(--border)] bg-white hover:border-[var(--accent)]"
                    }`}
                    title={candidate.reason || "Insertar variable"}
                  >
                    <p className="font-medium text-[var(--foreground)]">
                      {candidate.name}
                    </p>
                    <p className="font-mono text-[var(--foreground-muted)]">
                      {candidate.variableName}
                    </p>
                    {candidate.reason ? (
                      <p className="mt-1 text-[11px] text-[var(--warning)]">
                        {candidate.reason}
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            </aside>
          </div>
        ) : null}

        <div className="rounded-2xl bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground-muted)]">
          Rango de proyeccion heredado del board:{" "}
          {formatPeriodShortLabel(actualsEndPeriodKey)} a{" "}
          {formatPeriodShortLabel(forecastEndPeriodKey)}.
          {draft.method === "manual"
            ? " En ese rango los meses quedan editables desde la grilla."
            : ""}
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            disabled={
              pending ||
              (draft.method === "formula_placeholder" && hasFormulaErrors)
            }
            onClick={() =>
              onSave({
                ...draft,
                forecast_start_period_key: actualsEndPeriodKey,
                forecast_end_period_key: forecastEndPeriodKey,
              })
            }
          >
            Guardar configuracion
          </Button>
        </div>
      </div>
    </section>
  );
}

type PredictionConfigPanelProps = {
  premise: BoardPremise | null;
  actualsEndPeriodKey: string;
  forecastEndPeriodKey: string;
  availableVariables: string[];
  formulaCandidates: FormulaCandidate[];
  scenarioName: string;
  isBaseScenario: boolean;
  pending?: boolean;
  onSaveBase: (prediction: PredictionConfig) => Promise<void> | void;
  onSaveOverride: (prediction: PredictionConfig) => Promise<void> | void;
  onSaveYearSummaryMethod: (method: YearSummaryMethod) => Promise<void> | void;
  onClearOverride: () => Promise<void> | void;
};

const YEAR_METHOD_OPTIONS: Array<{ value: YearSummaryMethod; label: string }> =
  [
    { value: "sum", label: "Suma" },
    { value: "avg", label: "Promedio" },
    { value: "last_value", label: "Ultimo valor" },
  ];

export default function PredictionConfigPanel({
  actualsEndPeriodKey,
  availableVariables,
  forecastEndPeriodKey,
  formulaCandidates,
  isBaseScenario,
  onClearOverride,
  onSaveBase,
  onSaveOverride,
  pending = false,
  premise,
  scenarioName,
  onSaveYearSummaryMethod,
}: PredictionConfigPanelProps) {
  if (!premise) {
    return (
      <div className="rounded-[24px] border border-dashed border-[var(--border-strong)] bg-white p-5 text-sm text-[var(--foreground-muted)]">
        Selecciona una premisa para editar su logica de proyeccion.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-[var(--border)] bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--foreground-muted)]">
          Premisa seleccionada
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)]">
          {premise.name}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
          {premise.unit ? `${premise.unit} / ` : ""}
          {premise.category || "Sin categoria"}
        </p>
        <p className="mt-1 text-xs text-[var(--foreground-muted)]">
          Variable:{" "}
          <span className="font-mono">
            {premise.variable_name || "sin_variable"}
          </span>
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--foreground-muted)]">
          Timeline activo: historico hasta{" "}
          {formatPeriodShortLabel(actualsEndPeriodKey)} y proyeccion hasta{" "}
          {formatPeriodShortLabel(forecastEndPeriodKey)}.
        </p>
      </div>

      <PredictionConfigForm
        title="Prediccion base"
        prediction={premise.prediction_base}
        actualsEndPeriodKey={actualsEndPeriodKey}
        forecastEndPeriodKey={forecastEndPeriodKey}
        knownVariables={availableVariables}
        formulaCandidates={formulaCandidates}
        pending={pending}
        onSave={onSaveBase}
      />

      <section className="rounded-[24px] border border-[var(--border)] bg-white p-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Resumen anual
        </h3>
        <p className="mt-1 text-xs leading-5 text-[var(--foreground-muted)]">
          El valor anual se calcula en backend. Aqui defines la regla por
          premisa.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Select
            label="Metodo anual"
            value={premise.year_summary_method}
            onChange={(event) =>
              onSaveYearSummaryMethod(event.target.value as YearSummaryMethod)
            }
            disabled={pending}
          >
            {YEAR_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <p className="rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground-muted)]">
            Actual: {premise.year_summary_method_label}
          </p>
        </div>
      </section>

      {!isBaseScenario ? (
        premise.prediction_override ? (
          <div className="space-y-3 rounded-[24px] border border-[var(--border)] bg-[rgba(20,89,199,0.05)] p-4">
            <PredictionConfigForm
              title={`Override para ${scenarioName}`}
              prediction={premise.prediction_override}
              actualsEndPeriodKey={actualsEndPeriodKey}
              forecastEndPeriodKey={forecastEndPeriodKey}
              knownVariables={availableVariables}
              formulaCandidates={formulaCandidates}
              pending={pending}
              onSave={onSaveOverride}
            />
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={onClearOverride}>
                Limpiar override
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-[var(--border-strong)] bg-white p-4">
            <p className="text-sm text-[var(--foreground-muted)]">
              No hay override para el escenario {scenarioName}. Puedes crear uno
              guardando una configuracion especifica para esta premisa.
            </p>
            <div className="mt-3">
              <PredictionConfigForm
                title={`Nuevo override para ${scenarioName}`}
                prediction={premise.prediction_base}
                actualsEndPeriodKey={actualsEndPeriodKey}
                forecastEndPeriodKey={forecastEndPeriodKey}
                knownVariables={availableVariables}
                formulaCandidates={formulaCandidates}
                pending={pending}
                onSave={onSaveOverride}
              />
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
