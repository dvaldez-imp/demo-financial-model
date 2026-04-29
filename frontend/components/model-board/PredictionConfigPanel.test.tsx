import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PredictionConfigPanel from "@/components/model-board/PredictionConfigPanel";
import type { BoardPremise } from "@/lib/types/api";

const premise: BoardPremise = {
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
    forecast_start_period_key: "2025-07",
    forecast_end_period_key: "2025-12",
    method_label: "Manual",
  },
  prediction_override: null,
  year_summary_method: "last_value",
  year_summary_method_label: "Ultimo valor",
  values: [],
};

describe("PredictionConfigPanel", () => {
  it("submits base prediction payload", () => {
    const onSaveBase = vi.fn();

    render(
      <PredictionConfigPanel
        premise={premise}
        actualsEndPeriodKey="2025-03"
        forecastEndPeriodKey="2027-12"
        availableVariables={["gasolina", "demanda"]}
        formulaCandidates={[
          {
            premiseId: "prem_1",
            name: "Gasolina",
            variableName: "gasolina",
            disabled: false,
          },
        ]}
        scenarioName="Base"
        isBaseScenario
        onSaveBase={onSaveBase}
        onSaveOverride={vi.fn()}
        onSaveYearSummaryMethod={vi.fn()}
        onClearOverride={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Metodo"), {
      target: { value: "growth_rate_pct" },
    });
    fireEvent.change(screen.getByLabelText("Crecimiento % mensual"), {
      target: { value: "4.5" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar configuracion" }),
    );

    expect(onSaveBase).toHaveBeenCalledWith({
      method: "growth_rate_pct",
      params: { rate: 4.5 },
      forecast_start_period_key: "2025-03",
      forecast_end_period_key: "2027-12",
    });
  });

  it("submits moving average payload", () => {
    const onSaveBase = vi.fn();

    render(
      <PredictionConfigPanel
        premise={premise}
        actualsEndPeriodKey="2025-03"
        forecastEndPeriodKey="2027-12"
        availableVariables={["gasolina", "demanda"]}
        formulaCandidates={[]}
        scenarioName="Base"
        isBaseScenario
        onSaveBase={onSaveBase}
        onSaveOverride={vi.fn()}
        onSaveYearSummaryMethod={vi.fn()}
        onClearOverride={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Metodo"), {
      target: { value: "moving_average" },
    });
    fireEvent.change(screen.getByLabelText("Ventana de promedio (meses)"), {
      target: { value: "6" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar configuracion" }),
    );

    expect(onSaveBase).toHaveBeenCalledWith({
      method: "moving_average",
      params: { window: 6 },
      forecast_start_period_key: "2025-03",
      forecast_end_period_key: "2027-12",
    });
  });
});
