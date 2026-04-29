"use client";

import { useState } from "react";
import PremiseLibraryPanel from "@/components/library/PremiseLibraryPanel";
import NewPremiseModal from "@/components/modals/NewPremiseModal";
import {
  createLibraryPremise,
  deleteLibraryPremise,
  getLibraryPremises,
} from "@/lib/api/library";
import {
  createModelPremise,
  createPremiseFromOutput,
  getCatalogModelOutputs,
} from "@/lib/api/models";
import type { CatalogModelOutputOut, LibraryPremise } from "@/lib/types/api";
import type { NewPremiseFormValues } from "@/lib/types/board";

type PremiseLibraryPageProps = {
  modelId: string;
  initialPremises: LibraryPremise[];
  initialCatalogOutputs: CatalogModelOutputOut[];
};

export default function PremiseLibraryPage({
  modelId,
  initialCatalogOutputs,
  initialPremises,
}: PremiseLibraryPageProps) {
  const [premises, setPremises] = useState(initialPremises);
  const [catalogOutputs, setCatalogOutputs] = useState(initialCatalogOutputs);
  const [isModalOpen, setModalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  async function handleCreateLibraryPremise(values: NewPremiseFormValues) {
    await runAction(async () => {
      await createLibraryPremise({
        name: values.name,
        unit: values.unit || null,
        category: values.category || null,
        prediction: values.prediction,
      });
      const nextPremises = await getLibraryPremises();
      setPremises(nextPremises);
      setModalOpen(false);
      setMessage("Premisa creada en biblioteca.");
    });
  }

  async function handleAddPremise(premise: LibraryPremise) {
    await runAction(async () => {
      await createModelPremise(modelId, { library_premise_id: premise.id });
      setMessage(`${premise.name} se agrego al modelo.`);
    });
  }

  async function handleAddModelOutput(output: CatalogModelOutputOut) {
    await runAction(async () => {
      await createPremiseFromOutput(modelId, { output_id: output.id });
      const nextCatalog = await getCatalogModelOutputs();
      setCatalogOutputs(nextCatalog);
      setMessage(`${output.display_name} se agrego como premisa model_output.`);
    });
  }

  async function handleDeleteLibraryPremise(premise: LibraryPremise) {
    const confirmed = window.confirm(
      `Eliminar ${premise.name} de la biblioteca global? Esta accion afecta su disponibilidad para todos los modelos.`,
    );

    if (!confirmed) {
      return;
    }

    await runAction(async () => {
      await deleteLibraryPremise(premise.id);
      const nextPremises = await getLibraryPremises();
      setPremises(nextPremises);
      setMessage(`${premise.name} se elimino de la biblioteca.`);
    });
  }

  return (
    <section className="panel-surface rounded-[28px] p-4 sm:p-5">
      {message ? (
        <div className="mb-4 rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground-muted)]">
          {message}
        </div>
      ) : null}

      <PremiseLibraryPanel
        premises={premises}
        modelOutputsCatalog={catalogOutputs}
        onCreatePremise={() => setModalOpen(true)}
        onAddPremise={handleAddPremise}
        onDeletePremise={handleDeleteLibraryPremise}
        onAddModelOutput={handleAddModelOutput}
      />

      <NewPremiseModal
        contextLabel="biblioteca"
        open={isModalOpen}
        pending={pending}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreateLibraryPremise}
      />
    </section>
  );
}
