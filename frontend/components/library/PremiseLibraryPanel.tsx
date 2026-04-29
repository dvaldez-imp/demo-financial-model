"use client";

import { useMemo, useState } from "react";
import LibraryTabs from "@/components/library/LibraryTabs";
import PremiseSourceBadge from "@/components/model-board/PremiseSourceBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { CatalogModelOutputOut, LibraryPremise } from "@/lib/types/api";

type PremiseLibraryPanelProps = {
  premises: LibraryPremise[];
  modelOutputsCatalog: CatalogModelOutputOut[];
  onCreatePremise: () => void;
  onAddPremise: (premise: LibraryPremise) => void;
  onDeletePremise: (premise: LibraryPremise) => void;
  onAddModelOutput: (output: CatalogModelOutputOut) => void;
};

export default function PremiseLibraryPanel({
  modelOutputsCatalog,
  onAddModelOutput,
  onAddPremise,
  onDeletePremise,
  onCreatePremise,
  premises,
}: PremiseLibraryPanelProps) {
  const [activeTab, setActiveTab] = useState<"premises" | "model_outputs">(
    "premises",
  );
  const [query, setQuery] = useState("");

  const visiblePremises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return premises;
    }

    return premises.filter((premise) =>
      [premise.name, premise.category, premise.unit]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)),
    );
  }, [premises, query]);

  const visibleModelOutputs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return modelOutputsCatalog;
    }

    return modelOutputsCatalog.filter((output) =>
      [output.display_name, output.model_name, output.description]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)),
    );
  }, [modelOutputsCatalog, query]);

  return (
    <div className="space-y-4">
      <section className=" bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
              Biblioteca
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--foreground)]">
              Premisas y resultados
            </h2>
          </div>
          {activeTab === "premises" ? (
            <Button size="sm" variant="secondary" onClick={onCreatePremise}>
              Nueva premisa
            </Button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <LibraryTabs activeTab={activeTab} onChange={setActiveTab} />
          <input
            className="h-11 rounded-2xl border border-[var(--border)] bg-white px-3.5 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            placeholder={
              activeTab === "premises"
                ? "Buscar premisas por nombre, categoria o unidad"
                : "Buscar resultados por nombre visible o modelo"
            }
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </section>

      {activeTab === "premises" ? (
        <section className="space-y-3">
          {visiblePremises.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[var(--border-strong)] bg-white p-4 text-sm text-[var(--foreground-muted)]">
              No hay premisas que coincidan con esa busqueda.
            </div>
          ) : (
            visiblePremises.map((premise) => (
              <article
                key={premise.id}
                className="rounded-[24px] border border-[var(--border)] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">
                        {premise.name}
                      </h3>
                      <PremiseSourceBadge
                        source={premise.source}
                        label={premise.source_label}
                      />
                    </div>
                    <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                      {premise.category || "Sin categoria"}
                      {premise.unit ? ` · ${premise.unit}` : ""}
                    </p>
                    <p className="mt-2 text-xs text-[var(--foreground-muted)]">
                      {premise.prediction_base.method_label}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onAddPremise(premise)}
                    >
                      Agregar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeletePremise(premise)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      ) : (
        <section className="space-y-3">
          {visibleModelOutputs.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[var(--border-strong)] bg-white p-4 text-sm text-[var(--foreground-muted)]">
              No hay resultados de modelos disponibles.
            </div>
          ) : (
            visibleModelOutputs.map((output) => (
              <article
                key={output.id}
                className="rounded-[24px] border border-[var(--border)] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">
                        {output.display_name}
                      </h3>
                      <Badge tone="warning">Resultado de modelo</Badge>
                    </div>
                    <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                      {output.model_name}
                    </p>
                    {output.description ? (
                      <p className="mt-2 text-xs text-[var(--foreground-muted)]">
                        {output.description}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onAddModelOutput(output)}
                  >
                    Agregar
                  </Button>
                </div>
              </article>
            ))
          )}
        </section>
      )}
    </div>
  );
}
