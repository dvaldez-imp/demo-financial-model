import { describe, expect, it } from "vitest";
import type { BoardResponse } from "@/lib/types/api";
import {
  buildMappedImportText,
  serializeBoardToImportText,
} from "@/lib/utils/board-import";
import { parsePastedGrid } from "@/lib/utils/paste-grid";

const boardFixture: BoardResponse = {
  model: {
    id: "model_demo",
    name: "Modelo demo",
    frequency: "monthly",
    actuals_end_period_key: "2025-03",
    forecast_end_period_key: "2025-12",
  },
  periods: [
    {
      key: "2025-01",
      label: "ene-25",
      type: "month",
      year: 2025,
      month: 1,
      zone: "historical",
    },
    {
      key: "2025-04",
      label: "abr-25",
      type: "month",
      year: 2025,
      month: 4,
      zone: "forecast",
    },
    {
      key: "2025",
      label: "2025",
      type: "year_summary",
      year: 2025,
      month: null,
      zone: "summary",
    },
  ],
  scenarios: [{ id: "base", name: "Base" }],
  selected_scenario_id: "base",
  exported_outputs: [],
  premises: [
    {
      id: "prem_1",
      name: "Gasolina",
      unit: "Q/gal",
      category: "Costo",
      source: "library",
      source_label: "Biblioteca",
      source_ref_id: "lib_gasolina",
      dependency_type: "none",
      dependency_label: "Sin dependencia",
      source_model_id: null,
      source_output_id: null,
      prediction_base: {
        method: "manual",
        params: {},
        forecast_start_period_key: "2025-04",
        forecast_end_period_key: "2025-12",
        method_label: "Manual",
      },
      prediction_override: null,
      values: [
        {
          period_key: "2025-01",
          value: 34,
          value_origin: "actual",
          value_origin_label: "Actual",
          editable: true,
        },
        {
          period_key: "2025-04",
          value: 36,
          value_origin: "forecast_generated",
          value_origin_label: "Proyectado",
          editable: false,
        },
        {
          period_key: "2025",
          value: 420,
          value_origin: "year_summary",
          value_origin_label: "Resumen anual",
          editable: false,
        },
      ],
    },
  ],
};

describe("board import helpers", () => {
  it("serializes only editable or manual values to TSV", () => {
    expect(serializeBoardToImportText(boardFixture)).toBe(
      "Premisa\tene-25\tabr-25\t2025\nGasolina\t34\t\t",
    );
  });

  it("rewrites pasted row names when mapped to an existing premise", () => {
    const rawText = "Premisa\tene-25\nFila externa\t34";
    const preview = parsePastedGrid(rawText, "2025-03", "2025-12");

    expect(
      buildMappedImportText(rawText, preview, [
        { rowIndex: 0, mode: "existing", premiseName: "Gasolina" },
      ]),
    ).toBe("Premisa\tene-25\nGasolina\t34");
  });
});
