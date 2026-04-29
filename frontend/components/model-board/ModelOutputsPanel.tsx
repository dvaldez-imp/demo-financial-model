"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import type { BoardPremise, ModelOutputOut } from "@/lib/types/api";
import type { NewOutputFormValues } from "@/lib/types/board";

const DEFAULT_OUTPUT_VALUES: NewOutputFormValues = {
  name: "",
  displayName: "",
  description: "",
  sourcePremiseId: "",
  sourceMetricKey: "",
};

type ModelOutputsPanelProps = {
  outputs: ModelOutputOut[];
  premises: BoardPremise[];
  pending?: boolean;
  onCreateOutput: (values: NewOutputFormValues) => Promise<void> | void;
};

export default function ModelOutputsPanel({
  onCreateOutput,
  outputs,
  pending = false,
  premises,
}: ModelOutputsPanelProps) {
  const [values, setValues] = useState<NewOutputFormValues>(() => ({
    ...DEFAULT_OUTPUT_VALUES,
    sourcePremiseId: premises[0]?.id ?? "",
  }));
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreateOutput(values);
    setValues({
      ...DEFAULT_OUTPUT_VALUES,
      sourcePremiseId: premises[0]?.id ?? "",
    });
    setShowAdvanced(false);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-[var(--border)] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Outputs exportables
            </h2>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              Publica resultados del modelo para reutilizarlos en otros tableros.
            </p>
          </div>
          <Badge tone="accent">{outputs.length} activos</Badge>
        </div>

        <div className="mt-4 space-y-3">
          {outputs.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">
              Todavia no hay outputs exportados.
            </p>
          ) : (
            outputs.map((output) => (
              <article
                key={output.id}
                className="rounded-[20px] bg-[var(--surface-muted)] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      {output.display_name}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                      {output.name}
                      {output.description ? ` · ${output.description}` : ""}
                    </p>
                  </div>
                  <Badge tone={output.active ? "success" : "neutral"}>
                    {output.active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-[var(--border)] bg-white p-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          Crear output
        </h3>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <Input
            label="Nombre tecnico"
            placeholder="ebitda_proyectado"
            value={values.name}
            onChange={(event) =>
              setValues((current) => ({ ...current, name: event.target.value }))
            }
            required
          />
          <Input
            label="Nombre visible"
            placeholder="EBITDA proyectado"
            value={values.displayName}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                displayName: event.target.value,
              }))
            }
            required
          />
          <Input
            label="Descripcion"
            placeholder="Resultado listo para consumir en otros modelos"
            value={values.description}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Premisa fuente</span>
            <select
              className="h-11 rounded-2xl border border-[var(--border)] bg-white px-3.5 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              value={values.sourcePremiseId}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  sourcePremiseId: event.target.value,
                }))
              }
            >
              {premises.map((premise) => (
                <option key={premise.id} value={premise.id}>
                  {premise.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="text-sm font-medium text-[var(--accent)]"
            onClick={() => setShowAdvanced((current) => !current)}
          >
            {showAdvanced ? "Ocultar campo avanzado" : "Agregar source_metric_key"}
          </button>

          {showAdvanced ? (
            <Input
              label="source_metric_key"
              placeholder="ebitda"
              value={values.sourceMetricKey}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  sourceMetricKey: event.target.value,
                }))
              }
            />
          ) : null}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={
                pending ||
                values.name.trim().length === 0 ||
                values.displayName.trim().length === 0
              }
            >
              Crear output
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
