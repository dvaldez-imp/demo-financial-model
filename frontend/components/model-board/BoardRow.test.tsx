import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BoardRow from "@/components/model-board/BoardRow";
import type { BoardPremise, PeriodRecord } from "@/lib/types/api";

const periods: PeriodRecord[] = [
  {
    key: "2025-12",
    label: "dic-25",
    type: "month",
    year: 2025,
    month: 12,
    zone: "historical",
  },
  {
    key: "2026-01",
    label: "ene-26",
    type: "month",
    year: 2026,
    month: 1,
    zone: "forecast",
  },
];

const manualPremise: BoardPremise = {
  id: "prem_1",
  name: "Tipo de cambio USD/GTQ",
  variable_name: "tipo_cambio",
  unit: "Q/USD",
  category: "Macro",
  source: "library",
  source_label: "Biblioteca",
  source_ref_id: "lib_tipo_cambio",
  dependency_type: "none",
  dependency_label: "Sin dependencia",
  source_model_id: null,
  source_output_id: null,
  prediction_base: {
    method: "manual",
    params: {},
    forecast_start_period_key: "2026-01",
    forecast_end_period_key: "2026-12",
    method_label: "Manual",
  },
  prediction_override: null,
  year_summary_method: "last_value",
  year_summary_method_label: "Ultimo valor",
  values: [
    {
      period_key: "2025-12",
      value: 7.8,
      value_origin: "actual",
      value_origin_label: "Actual",
      editable: true,
    },
  ],
};

describe("BoardRow", () => {
  it("creates editable fallback cells for manual forecast months", () => {
    render(
      <table>
        <tbody>
          <BoardRow
            periods={periods}
            collapsingYears={{}}
            expandingYears={{}}
            premise={manualPremise}
            selected={false}
            onSelect={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onCellCommit={vi.fn()}
          />
        </tbody>
      </table>,
    );

    const forecastInput = screen.getByTitle("forecast_manual") as HTMLInputElement;

    expect(forecastInput.readOnly).toBe(false);
    expect(screen.getByText("Manual editable")).toBeInTheDocument();
    expect(
      screen.getByText(/Los meses en proyeccion quedan editables/i),
    ).toBeInTheDocument();
  });
});
