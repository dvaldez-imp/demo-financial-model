import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DependencyPanel from "@/components/model-board/DependencyPanel";
import type { BoardPremise, DependenciesResponse } from "@/lib/types/api";

const premise: BoardPremise = {
  id: "prem_1",
  name: "Gasolina",
  unit: "Q/gal",
  category: "Costo",
  source: "model_output",
  source_label: "Resultado de modelo",
  source_ref_id: "out_1",
  dependency_type: "model_output",
  dependency_label: "Depende de un output externo",
  source_model_id: "model_other",
  source_output_id: "out_1",
  prediction_base: {
    method: "manual",
    params: {},
    forecast_start_period_key: null,
    forecast_end_period_key: null,
    method_label: "Manual",
  },
  prediction_override: null,
  values: [],
};

const dependencyGraph: DependenciesResponse = {
  nodes: [
    {
      id: "out_1",
      type: "output",
      name: "EBITDA proyectado",
      model_id: "model_other",
      model_name: "Modelo origen",
    },
    {
      id: "prem_1",
      type: "premise",
      name: "Gasolina",
      model_id: null,
      model_name: null,
    },
  ],
  edges: [
    {
      from_type: "output",
      from_id: "out_1",
      to_type: "premise",
      to_id: "prem_1",
      relation: "uses",
    },
  ],
};

describe("DependencyPanel", () => {
  it("renders selected premise dependencies", () => {
    render(<DependencyPanel dependencyGraph={dependencyGraph} premise={premise} />);

    expect(screen.getByText("Dependencias de Gasolina")).toBeInTheDocument();
    expect(screen.getByText("EBITDA proyectado")).toBeInTheDocument();
    expect(screen.getByText(/Modelo origen model_other/)).toBeInTheDocument();
    expect(screen.getByText(/Usa · Modelo origen/)).toBeInTheDocument();
  });
});
