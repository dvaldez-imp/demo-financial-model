import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PremiseLibraryPanel from "@/components/library/PremiseLibraryPanel";
import type { CatalogModelOutputOut, LibraryPremise } from "@/lib/types/api";

const premises: LibraryPremise[] = [
  {
    id: "lib_1",
    model_id: "library",
    name: "Gasolina",
    unit: "Q/gal",
    category: "Costo",
    source: "library",
    source_label: "Biblioteca",
    source_ref_id: "lib_1",
    dependency_type: "none",
    dependency_label: "Sin dependencia",
    source_model_id: null,
    source_output_id: null,
    prediction_base: {
      method: "manual",
      params: {},
      forecast_start_period_key: null,
      forecast_end_period_key: null,
      method_label: "Manual",
    },
  },
];

const outputs: CatalogModelOutputOut[] = [
  {
    id: "out_1",
    model_id: "model_other",
    model_name: "Modelo origen",
    name: "ebitda",
    display_name: "EBITDA proyectado",
    source_premise_id: "prem_9",
    source_metric_key: null,
    description: "Output compartido",
    active: true,
  },
];

describe("PremiseLibraryPanel", () => {
  it("filters premises and triggers add action", async () => {
    const onAddPremise = vi.fn();

    render(
      <PremiseLibraryPanel
        premises={premises}
        modelOutputsCatalog={outputs}
        onCreatePremise={vi.fn()}
        onAddPremise={onAddPremise}
        onAddModelOutput={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Buscar premisas/i), {
      target: { value: "gas" },
    });

    await waitFor(() => {
      expect(screen.getByText("Gasolina")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    expect(onAddPremise).toHaveBeenCalledWith(premises[0]);
  });

  it("switches to model outputs tab and adds an output", () => {
    const onAddModelOutput = vi.fn();

    render(
      <PremiseLibraryPanel
        premises={premises}
        modelOutputsCatalog={outputs}
        onCreatePremise={vi.fn()}
        onAddPremise={vi.fn()}
        onAddModelOutput={onAddModelOutput}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Resultados de modelos" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    expect(onAddModelOutput).toHaveBeenCalledWith(outputs[0]);
  });
});
