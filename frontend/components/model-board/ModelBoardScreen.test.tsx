import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ModelBoardScreen from "@/components/model-board/ModelBoardScreen";
import type { BoardResponse } from "@/lib/types/api";

const replaceMock = vi.fn();
const pushMock = vi.fn();
const useBoardDraftMock = vi.fn();
const getModelDependenciesMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
  usePathname: () => "/models/model_1/board",
}));

vi.mock("@/hooks/useBoardDraft", () => ({
  useBoardDraft: (...args: unknown[]) => useBoardDraftMock(...args),
}));

vi.mock("@/lib/api/models", () => ({
  createModelPremise: vi.fn(),
  createModelScenario: vi.fn(),
  deleteModelPremise: vi.fn(),
  getModelBoard: vi.fn(),
  getModelDependencies: (...args: unknown[]) => getModelDependenciesMock(...args),
  importModelGrid: vi.fn(),
  updateModelTimeline: vi.fn(),
}));

vi.mock("@/lib/api/scenarios", () => ({
  buildScenarioOverridePayload: vi.fn(),
  updatePremisePredictionConfig: vi.fn(),
  updatePremiseYearSummaryConfig: vi.fn(),
}));

vi.mock("@/components/model-board/BoardHeader", () => ({
  default: () => <div data-testid="board-header" />,
}));

vi.mock("@/components/model-board/BoardGrid", () => ({
  default: () => <div data-testid="board-grid" />,
}));

vi.mock("@/components/model-board/BoardChartsWorkspace", () => ({
  default: () => <div data-testid="board-charts-workspace" />,
}));

vi.mock("@/components/model-board/PredictionConfigPanel", () => ({
  default: () => <div data-testid="prediction-config-panel" />,
}));

vi.mock("@/components/modals/CreateScenarioModal", () => ({
  default: () => null,
}));

vi.mock("@/components/modals/NewPremiseModal", () => ({
  default: () => null,
}));

vi.mock("@/components/modals/PasteExcelModal", () => ({
  default: () => null,
}));

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
}));

const board: BoardResponse = {
  model: {
    id: "model_1",
    name: "Modelo holding consolidado",
    frequency: "monthly",
    actuals_end_period_key: "2025-12",
    forecast_end_period_key: "2026-12",
  },
  periods: [
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
    {
      key: "2025",
      label: "2025",
      type: "year_summary",
      year: 2025,
      month: null,
      zone: "summary",
    },
    {
      key: "2026",
      label: "2026",
      type: "year_summary",
      year: 2026,
      month: null,
      zone: "summary",
    },
  ],
  year_groups: [
    {
      year: 2025,
      summary_period_key: "2025",
      month_period_keys: ["2025-12"],
    },
    {
      year: 2026,
      summary_period_key: "2026",
      month_period_keys: ["2026-01"],
    },
  ],
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

describe("ModelBoardScreen", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    pushMock.mockReset();
    getModelDependenciesMock.mockResolvedValue({ nodes: [], edges: [] });
    window.localStorage.clear();

    useBoardDraftMock.mockReturnValue({
      banner: null,
      board,
      hasBoardChanges: false,
      hasTimelineChanges: false,
      isDirty: false,
      resetBoard: vi.fn(),
      selectedPremiseId: null,
      setBanner: vi.fn(),
      setSelectedPremiseId: vi.fn(),
      timelineDraft: {
        actualsEndPeriodKey: "2025-12",
        forecastEndPeriodKey: "2026-12",
      },
      updateCellValue: vi.fn(),
      updatePremisePrediction: vi.fn(),
      updateTimelineDraft: vi.fn(),
    });
  });

  it("renders the table view from the incoming route state", async () => {
    render(<ModelBoardScreen initialBoard={board} initialView="table" />);

    await waitFor(() => {
      expect(getModelDependenciesMock).toHaveBeenCalled();
    });
    expect(screen.getByTestId("board-grid")).toBeInTheDocument();
    expect(
      screen.queryByTestId("board-charts-workspace"),
    ).not.toBeInTheDocument();
  });

  it("switches to charts and persists the view in the URL", async () => {
    render(<ModelBoardScreen initialBoard={board} initialView="table" />);

    fireEvent.click(screen.getByRole("tab", { name: /charts/i }));

    await waitFor(() => {
      expect(screen.getByTestId("board-charts-workspace")).toBeInTheDocument();
    });
    expect(replaceMock).toHaveBeenCalledWith(
      "/models/model_1/board?view=charts",
      {
        scroll: false,
      },
    );
  });
});
