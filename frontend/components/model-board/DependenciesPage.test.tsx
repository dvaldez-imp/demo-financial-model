import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DependenciesPage from "@/components/model-board/DependenciesPage";
import { getModelDependenciesTree } from "@/lib/api/models";
import type { BoardPremise, DependencyTreeResponse } from "@/lib/types/api";

vi.mock("@/lib/api/models", () => ({
  getModelDependenciesTree: vi.fn(),
}));

function buildPremise(
  id: string,
  name: string,
  source: BoardPremise["source"],
  overrides: Partial<BoardPremise> = {},
): BoardPremise {
  return {
    id,
    name,
    variable_name: undefined,
    unit: "Q",
    category: "Demo",
    source,
    source_label:
      source === "library"
        ? "Biblioteca"
        : source === "model_output"
          ? "Resultado de modelo"
          : "Premisa local",
    source_ref_id: null,
    dependency_type:
      source === "model_output" ? "model_output" : "local_premise",
    dependency_label:
      source === "model_output"
        ? "Depende de un output externo"
        : "Depende de premisas internas",
    source_model_id: null,
    source_output_id: null,
    prediction_base: {
      method: "manual",
      params: {},
      forecast_start_period_key: null,
      forecast_end_period_key: null,
      method_label: "Manual",
    },
    prediction_override: null,
    year_summary_method: "sum",
    year_summary_method_label: "Suma",
    values: [],
    ...overrides,
  };
}

const premises: BoardPremise[] = [
  buildPremise("prem_root", "Resultado holding", "local", {
    prediction_base: {
      method: "formula_placeholder",
      params: {},
      forecast_start_period_key: null,
      forecast_end_period_key: null,
      method_label: "Formula",
    },
  }),
  buildPremise("prem_child_local", "Costo corporativo", "local"),
  buildPremise("prem_child_library", "Factor biblioteca", "library"),
  buildPremise("prem_child_imported", "Ingreso retail consolidado", "model_output", {
    source_model_id: "model_ventas",
    source_output_id: "out_sales",
  }),
  buildPremise("prem_local_leaf", "Nomina central", "local"),
  buildPremise("prem_library_leaf", "Margen biblioteca", "library"),
];

const dependencyTree: DependencyTreeResponse = {
  root: {
    id: "prem_root",
    type: "premise",
    name: "Resultado holding",
  },
  nodes: [
    {
      id: "prem_root",
      type: "premise",
      name: "Resultado holding",
      model_name: "Holding",
    },
    {
      id: "prem_child_local",
      type: "premise",
      name: "Costo corporativo",
      model_name: "Holding",
    },
    {
      id: "prem_child_library",
      type: "premise",
      name: "Factor biblioteca",
      model_name: "Holding",
    },
    {
      id: "prem_child_imported",
      type: "premise",
      name: "Ingreso retail consolidado",
      model_name: "Holding",
    },
    {
      id: "prem_local_leaf",
      type: "premise",
      name: "Nomina central",
      model_name: "Holding",
    },
    {
      id: "prem_library_leaf",
      type: "premise",
      name: "Margen biblioteca",
      model_name: "Holding",
    },
    {
      id: "prem_source_sales",
      type: "premise",
      name: "Ingreso neto retail",
      model_name: "Ventas",
    },
    {
      id: "out_sales",
      type: "model_output",
      name: "Ingreso neto consolidado",
      model_name: "Modelo ventas",
    },
  ],
  edges: [
    {
      from_id: "prem_child_local",
      to_id: "prem_root",
      relation: "derives_from",
    },
    {
      from_id: "prem_child_library",
      to_id: "prem_root",
      relation: "derives_from",
    },
    {
      from_id: "prem_child_imported",
      to_id: "prem_root",
      relation: "derives_from",
    },
    {
      from_id: "prem_local_leaf",
      to_id: "prem_child_local",
      relation: "derives_from",
    },
    {
      from_id: "prem_library_leaf",
      to_id: "prem_child_library",
      relation: "derives_from",
    },
    {
      from_id: "out_sales",
      to_id: "prem_child_imported",
      relation: "uses",
    },
    {
      from_id: "prem_source_sales",
      to_id: "out_sales",
      relation: "exports",
    },
  ],
  unique_dependencies: [
    {
      id: "prem_child_library",
      type: "library",
      name: "Factor biblioteca",
      model_name: "Holding",
    },
    {
      id: "out_sales",
      type: "model_output",
      name: "Ingreso neto consolidado",
      model_name: "Modelo ventas",
    },
  ],
};

describe("DependenciesPage", () => {
  beforeEach(() => {
    vi.mocked(getModelDependenciesTree).mockResolvedValue(dependencyTree);
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("starts with only the root visible", async () => {
    const { container } = render(
      <DependenciesPage modelId="model_holding" premises={premises} />,
    );

    await waitFor(() => {
      expect(
        container.querySelector('[data-node-id="prem_root"]'),
      ).toBeInTheDocument();
    });
    expect(
      container.querySelector('[data-node-id="prem_child_local"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-node-id="prem_child_library"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-node-id="prem_child_imported"]'),
    ).not.toBeInTheDocument();
  });

  it("applies accordion behavior, colors sources, and toggles output chips", async () => {
    const { container } = render(
      <DependenciesPage modelId="model_holding" premises={premises} />,
    );

    await waitFor(() => {
      expect(
        container.querySelector('[data-node-id="prem_root"]'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Alternar Resultado holding"));

    await waitFor(() => {
      expect(
        container.querySelector('[data-node-id="prem_child_local"]'),
      ).toBeInTheDocument();
      expect(
        container.querySelector('[data-node-id="prem_child_library"]'),
      ).toBeInTheDocument();
      expect(
        container.querySelector('[data-node-id="prem_child_imported"]'),
      ).toBeInTheDocument();
      expect(
        container.querySelector('[data-output-chip-id="out_sales"]'),
      ).toBeInTheDocument();
    });

    const localNode = container.querySelector('[data-node-id="prem_child_local"]');
    const libraryNode = container.querySelector(
      '[data-node-id="prem_child_library"]',
    );
    const importedNode = container.querySelector(
      '[data-node-id="prem_child_imported"]',
    );

    expect(localNode).toHaveAttribute("data-origin", "local");
    expect(libraryNode).toHaveAttribute("data-origin", "library");
    expect(importedNode).toHaveAttribute("data-origin", "model_output");

    fireEvent.click(screen.getByLabelText("Alternar Costo corporativo"));
    await waitFor(() => {
      expect(
        container.querySelector('[data-node-id="prem_local_leaf"]'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Alternar Factor biblioteca"));
    await waitFor(() => {
      expect(
        container.querySelector('[data-node-id="prem_library_leaf"]'),
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(
        container.querySelector('[data-node-id="prem_local_leaf"]'),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByLabelText("Alternar origen Ingreso retail consolidado"),
    );
    await waitFor(() => {
      expect(
        container.querySelector('[data-output-chip-id="out_sales"]'),
      ).not.toBeInTheDocument();
    });
    expect(importedNode).toBeInTheDocument();

    fireEvent.click(
      screen.getByLabelText("Alternar origen Ingreso retail consolidado"),
    );
    await waitFor(() => {
      expect(
        container.querySelector('[data-output-chip-id="out_sales"]'),
      ).toBeInTheDocument();
    });
  });

  it("search opens ancestors and selects the matching branch", async () => {
    const { container } = render(
      <DependenciesPage modelId="model_holding" premises={premises} />,
    );

    await waitFor(() => {
      expect(
        container.querySelector('[data-node-id="prem_root"]'),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Gasolina, ingreso/i), {
      target: { value: "Margen biblioteca" },
    });
    fireEvent.click(screen.getByText("Buscar"));

    await waitFor(() => {
      expect(
        container.querySelector('[data-node-id="prem_child_library"]'),
      ).toBeInTheDocument();
      expect(
        container.querySelector('[data-node-id="prem_library_leaf"]'),
      ).toBeInTheDocument();
    });
    expect(
      container.querySelector('[data-node-id="prem_local_leaf"]'),
    ).not.toBeInTheDocument();
  });
});
