"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import type { PredictionMethod } from "@/lib/types/api";
import type { NewPremiseFormValues } from "@/lib/types/board";
import { compileFormulaExpression } from "@/lib/utils/formula-compiler";
import {
  buildDefaultPredictionParams,
  getPredictionMethodLabel,
} from "@/lib/utils/periods";

const DEFAULT_VALUES: NewPremiseFormValues = {
  name: "",
  unit: "",
  category: "",
  prediction: {
    method: "manual",
    params: {},
  },
};

type NewPremiseModalProps = {
  contextLabel: "modelo" | "biblioteca";
  open: boolean;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (values: NewPremiseFormValues) => Promise<void> | void;
};

export default function NewPremiseModal({
  contextLabel,
  onClose,
  onSubmit,
  open,
  pending = false,
}: NewPremiseModalProps) {
  const [values, setValues] = useState(DEFAULT_VALUES);
  const method = values.prediction.method;
  const expression = `${values.prediction.params.expression ?? ""}`;
  const formulaCompile = useMemo(
    () =>
      method === "formula_placeholder"
        ? compileFormulaExpression(expression)
        : null,
    [expression, method],
  );
  const hasFormulaErrors =
    formulaCompile?.diagnostics.some((item) => item.level === "error") || false;

  function handleClose() {
    setValues(DEFAULT_VALUES);
    onClose();
  }

  function setMethod(nextMethod: PredictionMethod) {
    setValues((current) => ({
      ...current,
      prediction: {
        method: nextMethod,
        params: buildDefaultPredictionParams(
          nextMethod,
          current.prediction.params,
        ),
      },
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      ...values,
      name: values.name.trim(),
      unit: values.unit.trim(),
      category: values.category.trim(),
    });
    setValues(DEFAULT_VALUES);
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nueva premisa"
      description={`Crear una premisa reusable para ${contextLabel}.`}
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="Nombre"
          placeholder="Precio gasolina regular"
          hint="Ejemplos: Tipo de cambio USD/GTQ, Costo energia planta, Volumen importado desde ventas, Resultado operacion."
          value={values.name}
          onChange={(event) =>
            setValues((current) => ({ ...current, name: event.target.value }))
          }
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Unidad"
            placeholder="Q/gal"
            hint="Ejemplos: Q/gal, Q/USD, ton, %, Q/ton."
            value={values.unit}
            onChange={(event) =>
              setValues((current) => ({ ...current, unit: event.target.value }))
            }
          />
          <Input
            label="Categoria"
            placeholder="Costo"
            hint="Ejemplos: Costo, Macro, Operacion, Ingreso, Resultado."
            value={values.category}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
          />
        </div>
        <Select
          label="Metodo de prediccion"
          value={method}
          onChange={(event) =>
            setMethod(event.target.value as PredictionMethod)
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

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 text-sm text-[var(--foreground-muted)]">
          {method === "manual"
            ? "Manual sirve para dejar la proyeccion editable mes a mes. Si luego vienes de una proyeccion automatica, el backend conserva esos valores y te deja afinarlos a mano."
            : method === "carry_forward"
              ? "Usalo cuando quieras una linea base simple que repita el ultimo valor historico."
              : method === "growth_rate_pct"
                ? "Buen fit para gasolina, precio promedio por tonelada o volumenes con tendencia mensual."
                : method === "moving_average"
                  ? "Ideal para suavizar macro o series con ruido de corto plazo usando una ventana movil."
                  : method === "linear_trend"
                    ? "Bueno para demanda o volumenes que muestran pendiente clara en la historia reciente."
                    : method === "seasonal_naive"
                      ? "Replica estacionalidad historica. Buen ajuste para combustible u otras series ciclicas."
                      : method === "arima_like"
                        ? "Usa más historia para una proyeccion automatica más robusta en series con inercia."
                : "Ideal para premisas derivadas como ingreso_bruto, costo_variable o resultado_operacion."}
        </div>

        {method === "growth_rate_pct" ? (
          <Input
            label="Tasa % mensual"
            type="number"
            step="0.1"
            value={`${values.prediction.params.rate ?? 0}`}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                prediction: {
                  ...current.prediction,
                  params: { rate: Number(event.target.value) },
                },
              }))
            }
          />
        ) : null}

        {method === "moving_average" ? (
          <Input
            label="Ventana de promedio (meses)"
            type="number"
            min="2"
            step="1"
            value={`${values.prediction.params.window ?? 4}`}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                prediction: {
                  ...current.prediction,
                  params: { window: Number(event.target.value) },
                },
              }))
            }
          />
        ) : null}

        {method === "linear_trend" || method === "arima_like" ? (
          <Input
            label="Ventana historica (meses)"
            type="number"
            min="3"
            step="1"
            value={`${values.prediction.params.lookback_periods ?? (method === "arima_like" ? 24 : 12)}`}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                prediction: {
                  ...current.prediction,
                  params: { lookback_periods: Number(event.target.value) },
                },
              }))
            }
          />
        ) : null}

        {method === "seasonal_naive" ? (
          <Input
            label="Longitud estacional (meses)"
            type="number"
            min="2"
            step="1"
            value={`${values.prediction.params.season_length ?? 12}`}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                prediction: {
                  ...current.prediction,
                  params: { season_length: Number(event.target.value) },
                },
              }))
            }
          />
        ) : null}

        {method === "formula_placeholder" ? (
          <div className="space-y-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-[var(--foreground)]">
                Formula
              </span>
              <textarea
                rows={3}
                placeholder="precio_promedio * demanda_importada"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                className={`rounded-2xl border bg-white px-3.5 py-2 font-mono text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] ${
                  hasFormulaErrors
                    ? "border-[var(--danger)]"
                    : "border-[var(--border)]"
                }`}
                value={expression}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    prediction: {
                      ...current.prediction,
                      params: { expression: event.target.value },
                    },
                  }))
                }
              />
            </label>

            {formulaCompile ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
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

            <div className="rounded-xl border border-dashed border-[var(--border)] bg-white px-3 py-2 text-xs leading-5 text-[var(--foreground-muted)]">
              Ejemplos:
              <br />
              ingreso_bruto = precio_promedio * demanda_importada
              <br />
              costo_variable = gasolina * demanda_importada + gasto_logistico +
              gasto_energia
            </div>
          </div>
        ) : null}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={
              pending ||
              values.name.trim().length === 0 ||
              (method === "formula_placeholder" && hasFormulaErrors)
            }
          >
            Crear premisa
          </Button>
        </div>
      </form>
    </Modal>
  );
}
