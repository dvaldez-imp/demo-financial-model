import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BoardHeader from "@/components/model-board/BoardHeader";
import type { BoardResponse, PeriodRecord } from "@/lib/types/api";

const board: BoardResponse = {
  model: {
    id: "model_1",
    name: "Modelo holding consolidado",
    frequency: "monthly",
    actuals_end_period_key: "2025-12",
    forecast_end_period_key: "2026-12",
  },
  periods: [],
  year_groups: [],
  scenarios: [
    {
      id: "scn_base",
      name: "Base",
    },
  ],
  selected_scenario_id: "scn_base",
  premises: [],
  exported_outputs: [],
};

const monthPeriods: PeriodRecord[] = [
  {
    key: "2025-12",
    label: "dic-25",
    type: "month",
    year: 2025,
    month: 12,
    zone: "historical",
  },
  {
    key: "2026-12",
    label: "dic-26",
    type: "month",
    year: 2026,
    month: 12,
    zone: "forecast",
  },
];

describe("BoardHeader", () => {
  it("renders compact by default and hides secondary actions", () => {
    render(
      <BoardHeader
        board={board}
        monthPeriods={monthPeriods}
        banner={null}
        isBusy={false}
        isDirty={false}
        isCompact
        actualsEndPeriodKey="2025-12"
        forecastEndPeriodKey="2026-12"
        onToggleCompact={vi.fn()}
        onOpenCreatePremise={vi.fn()}
        onOpenCreateScenario={vi.fn()}
        onOpenLibrary={vi.fn()}
        onOpenOutputs={vi.fn()}
        onOpenDependencies={vi.fn()}
        onOpenPasteModal={vi.fn()}
        onSave={vi.fn()}
        onScenarioChange={vi.fn()}
        onActualsEndChange={vi.fn()}
        onForecastEndChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /expandir header/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Pegar desde Excel/i)).not.toBeInTheDocument();
  });

  it("shows expanded controls when the header is open", () => {
    const onToggleCompact = vi.fn();

    render(
      <BoardHeader
        board={board}
        monthPeriods={monthPeriods}
        banner={null}
        isBusy={false}
        isDirty
        isCompact={false}
        actualsEndPeriodKey="2025-12"
        forecastEndPeriodKey="2026-12"
        onToggleCompact={onToggleCompact}
        onOpenCreatePremise={vi.fn()}
        onOpenCreateScenario={vi.fn()}
        onOpenLibrary={vi.fn()}
        onOpenOutputs={vi.fn()}
        onOpenDependencies={vi.fn()}
        onOpenPasteModal={vi.fn()}
        onSave={vi.fn()}
        onScenarioChange={vi.fn()}
        onActualsEndChange={vi.fn()}
        onForecastEndChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Pegar desde Excel/i)).toBeInTheDocument();
    expect(screen.getByText(/Ir a biblioteca/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /minimizar header/i }));
    expect(onToggleCompact).toHaveBeenCalledTimes(1);
  });
});
