import type {
  BoardPremise,
  BoardResponse,
  BoardValue,
  CatalogModelOutputOut,
  DependenciesResponse,
  LibraryPremise,
  ModelOutputOut,
  PredictionConfig,
} from "@/lib/types/api";

export type RailTab = "prediction" | "library" | "dependencies" | "outputs";
export type BoardViewMode = "table" | "charts";

export type DraftBoardState = BoardResponse;

export type NewPremiseFormValues = {
  name: string;
  unit: string;
  category: string;
  prediction: PredictionConfig;
};

export type NewScenarioFormValues = {
  name: string;
  description: string;
};

export type NewOutputFormValues = {
  name: string;
  displayName: string;
  description: string;
  sourcePremiseId: string;
  sourceMetricKey: string;
};

export type TimelineDraft = {
  actualsEndPeriodKey: string;
  forecastEndPeriodKey: string;
};

export type BoardBannerTone = "info" | "success" | "error";

export type BoardBanner = {
  tone: BoardBannerTone;
  message: string;
};

export type BoardPeriodValueMap = Record<string, number | null>;

export type BoardDraftPayload = {
  board: BoardResponse;
  timeline: TimelineDraft;
  selectedPremiseId: string | null;
  activeRailTab: RailTab;
};

export type BoardScreenData = {
  board: BoardResponse;
  libraryPremises: LibraryPremise[];
  dependencyGraph: DependenciesResponse;
  modelOutputs: ModelOutputOut[];
  catalogOutputs: CatalogModelOutputOut[];
};

export function buildPremiseValueMap(premise: BoardPremise): BoardPeriodValueMap {
  return premise.values.reduce<BoardPeriodValueMap>((accumulator, item) => {
    accumulator[item.period_key] = item.value;
    return accumulator;
  }, {});
}

export function cloneBoardValue(value: BoardValue): BoardValue {
  return { ...value };
}
