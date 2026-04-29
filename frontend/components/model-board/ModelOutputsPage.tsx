"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  createModelOutput,
  getModelOutputs,
  updateModelOutput,
} from "@/lib/api/models";
import type { BoardPremise, ModelOutputOut } from "@/lib/types/api";
import type { NewOutputFormValues } from "@/lib/types/board";

const DEFAULT_OUTPUT_VALUES: NewOutputFormValues = {
  name: "",
  displayName: "",
  description: "",
  sourcePremiseId: "",
  sourceMetricKey: "",
};

type ModelOutputsPageProps = {
  modelId: string;
  premises: BoardPremise[];
  initialOutputs: ModelOutputOut[];
};

export default function ModelOutputsPage({
  modelId,
  premises,
  initialOutputs,
}: ModelOutputsPageProps) {
  const [outputs, setOutputs] = useState(initialOutputs);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [values, setValues] = useState<NewOutputFormValues>(() => ({
    ...DEFAULT_OUTPUT_VALUES,
    sourcePremiseId: premises[0]?.id ?? "",
  }));

  async function refreshOutputs() {
    const next = await getModelOutputs(modelId);
    setOutputs(next);
  }

  async function runAction(action: () => Promise<void>) {
    setPending(true);

    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo completar la accion.",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleCreateOutput(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runAction(async () => {
      await createModelOutput(modelId, {
        name: values.name,
        display_name: values.displayName,
        description: values.description || null,
        source_premise_id: values.sourcePremiseId || null,
        source_metric_key: values.sourceMetricKey || null,
      });
      await refreshOutputs();
      setValues({
        ...DEFAULT_OUTPUT_VALUES,
        sourcePremiseId: premises[0]?.id ?? "",
      });
      setMessage("Output exportable creado.");
    });
  }

  async function handleToggleReusable(output: ModelOutputOut) {
    await runAction(async () => {
      await updateModelOutput(modelId, output.id, { active: !output.active });
      await refreshOutputs();
      setMessage(`Output ${output.display_name} actualizado.`);
    });
  }

  async function handleRename(output: ModelOutputOut) {
    const nextName = window.prompt("Nuevo nombre visible", output.display_name);

    if (!nextName) {
      return;
    }

    await runAction(async () => {
      await updateModelOutput(modelId, output.id, { display_name: nextName });
      await refreshOutputs();
      setMessage(`Nombre visible actualizado para ${output.name}.`);
    });
  }

  return (
    <section className="panel-surface rounded-[28px] p-4 sm:p-5">
      {message ? (
        <div className="mb-4 rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground-muted)]">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="rounded-[24px] border border-[var(--border)] bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Outputs exportables
            </h2>
            <div className="flex items-center gap-2">
              <Badge tone="accent">{outputs.length}</Badge>
              <Link
                href={`/models/${modelId}/library`}
                className="rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--foreground-muted)]"
              >
                Ir a biblioteca
              </Link>
            </div>
          </div>
          <div className="space-y-3">
            {outputs.map((output) => (
              <article
                key={output.id}
                className="rounded-[20px] border border-[var(--border)] bg-[var(--surface-muted)] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {output.display_name}
                    </p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {output.name}
                    </p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      Fuente:{" "}
                      {premises.find(
                        (premise) => premise.id === output.source_premise_id,
                      )?.name || "Sin premisa"}
                    </p>
                  </div>
                  <Badge tone={output.active ? "success" : "neutral"}>
                    {output.active ? "Reutilizable" : "No reutilizable"}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleRename(output)}
                  >
                    Editar nombre
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleReusable(output)}
                  >
                    {output.active ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-[var(--border)] bg-white p-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Crear output
          </h3>
          <form className="mt-4 space-y-3" onSubmit={handleCreateOutput}>
            <Input
              label="Nombre tecnico"
              value={values.name}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              required
            />
            <Input
              label="Nombre visible"
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
              value={values.description}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-[var(--foreground)]">
                Premisa fuente
              </span>
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
            <Input
              label="source_metric_key"
              value={values.sourceMetricKey}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  sourceMetricKey: event.target.value,
                }))
              }
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                Crear output
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
