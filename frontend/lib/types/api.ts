export type Frequency = "monthly";
export type PeriodType = "month" | "year_summary";
export type PeriodZone = "historical" | "forecast" | "summary";
export type PremiseSource = "local" | "library" | "model_output";
export type DependencyType = "none" | "local_premise" | "model_output";
export type ValueOrigin =
  | "actual"
  | "forecast_generated"
  | "forecast_manual"
  | "year_summary";
export type PredictionMethod =
  | "manual"
  | "carry_forward"
  | "growth_rate_pct"
  | "formula_placeholder"
  | "moving_average"
  | "linear_trend"
  | "seasonal_naive"
  | "arima_like";
export type YearSummaryMethod = "sum" | "avg" | "last_value";

export type PredictionParams = Record<string, unknown>;

export type PredictionConfig = {
  method: PredictionMethod;
  params: PredictionParams;
  forecast_start_period_key?: string | null;
  forecast_end_period_key?: string | null;
};

export type PredictionConfigOut = PredictionConfig & {
  method_label: string;
};

export type ModelOut = {
  id: string;
  name: string;
  frequency: Frequency;
  actuals_end_period_key: string | null;
  forecast_end_period_key: string | null;
};

export type PeriodRecord = {
  key: string;
  label: string;
  type: PeriodType;
  year: number;
  month: number | null;
  zone: PeriodZone;
};

export type BoardScenarioOut = {
  id: string;
  name: string;
};

export type BoardValue = {
  period_key: string;
  value: number | null;
  value_origin: ValueOrigin;
  value_origin_label: string;
  editable: boolean;
};

export type BoardPremise = {
  id: string;
  name: string;
  variable_name?: string;
  unit: string | null;
  category: string | null;
  source: PremiseSource;
  source_label: string;
  source_ref_id: string | null;
  dependency_type: DependencyType;
  dependency_label: string;
  source_model_id: string | null;
  source_output_id: string | null;
  prediction_base: PredictionConfigOut;
  prediction_override: PredictionConfigOut | null;
  year_summary_method: YearSummaryMethod;
  year_summary_method_label: string;
  values: BoardValue[];
};

export type YearGroupRecord = {
  year: number;
  summary_period_key: string;
  month_period_keys: string[];
};

export type ModelOutputOut = {
  id: string;
  model_id: string;
  name: string;
  display_name: string;
  source_premise_id: string | null;
  source_metric_key: string | null;
  description: string | null;
  active: boolean;
};

export type CatalogModelOutputOut = ModelOutputOut & {
  model_name: string;
};

export type BoardResponse = {
  model: ModelOut;
  periods: PeriodRecord[];
  year_groups?: YearGroupRecord[];
  scenarios: BoardScenarioOut[];
  selected_scenario_id: string;
  premises: BoardPremise[];
  exported_outputs: ModelOutputOut[];
};

export type PremiseOut = {
  id: string;
  model_id: string;
  name: string;
  variable_name?: string;
  unit: string | null;
  category: string | null;
  source: PremiseSource;
  source_label: string;
  source_ref_id: string | null;
  dependency_type: DependencyType;
  dependency_label: string;
  source_model_id: string | null;
  source_output_id: string | null;
  prediction_base: PredictionConfigOut;
};

export type LibraryPremise = PremiseOut;

export type ScenarioOut = {
  id: string;
  model_id: string;
  name: string;
  description: string | null;
};

export type ImportedRowOut = {
  premise_name: string;
  values: Record<string, number | null>;
};

export type ImportGridResponse = {
  detected_periods: PeriodRecord[];
  rows: ImportedRowOut[];
  created_premises: string[];
  updated_premises: string[];
};

export type DependencyNodeOut = {
  id: string;
  type: string;
  name: string;
  model_id: string | null;
  model_name: string | null;
};

export type DependencyEdgeOut = {
  from_type: string;
  from_id: string;
  to_type: string;
  to_id: string;
  relation: "uses" | "derives_from" | "exports";
};

export type DependenciesResponse = {
  nodes: DependencyNodeOut[];
  edges: DependencyEdgeOut[];
};

export type DependencyTreeRoot = {
  id: string;
  type: string;
  name: string;
};

export type DependencyTreeNode = {
  id: string;
  type: string;
  name: string;
  model_name?: string | null;
};

export type DependencyTreeEdge = {
  from_id: string;
  to_id: string;
  relation: "uses" | "derives_from" | "exports";
};

export type DependencyTreeResponse = {
  root: DependencyTreeRoot;
  nodes: DependencyTreeNode[];
  edges: DependencyTreeEdge[];
  unique_dependencies: DependencyTreeNode[];
};

export type CreateModelPremiseRequest = {
  library_premise_id?: string;
  name?: string;
  unit?: string | null;
  category?: string | null;
  prediction_base?: PredictionConfig;
  dependency_type?: DependencyType;
  source_ref_id?: string | null;
  source_model_id?: string | null;
  source_output_id?: string | null;
};

export type CreatePremiseFromOutputRequest = {
  output_id: string;
  name_override?: string | null;
};

export type CreateLibraryPremiseRequest = {
  name: string;
  unit?: string | null;
  category?: string | null;
  prediction?: PredictionConfig;
};

export type UpdatePremiseRequest = {
  name?: string | null;
  unit?: string | null;
  category?: string | null;
  dependency_type?: DependencyType | null;
  source_ref_id?: string | null;
  source_model_id?: string | null;
  source_output_id?: string | null;
};

export type UpdateVariableNameRequest = {
  variable_name: string;
};

export type CreateScenarioRequest = {
  name: string;
  description?: string | null;
};

export type UpdateScenarioRequest = {
  name?: string | null;
  description?: string | null;
};

export type UpdateTimelineRequest = {
  actuals_end_period_key: string;
  forecast_end_period_key: string;
};

export type ScenarioPredictionOverridePayload = PredictionConfig & {
  scenario_id: string;
};

export type UpdatePredictionConfigRequest = {
  base?: PredictionConfig | null;
  scenario_override?: ScenarioPredictionOverridePayload | null;
};

export type UpdateYearSummaryConfigRequest = {
  year_summary_method: YearSummaryMethod;
};

export type CreateOutputRequest = {
  name: string;
  display_name: string;
  source_premise_id?: string | null;
  source_metric_key?: string | null;
  description?: string | null;
};

export type UpdateOutputRequest = {
  name?: string | null;
  display_name?: string | null;
  source_premise_id?: string | null;
  source_metric_key?: string | null;
  description?: string | null;
  active?: boolean | null;
};

export type DeleteResponse = {
  ok: boolean;
  message?: string;
};

export type ActivityLogEntryOut = {
  id: string;
  timestamp: string;
  user: string;
  user_initials: string;
  user_color: string;
  action_type: string;
  target_type: string;
  target_name: string;
  model_name: string;
  description: string;
  detail: string | null;
};

export type CreateActivityLogRequest = {
  user: string;
  user_initials: string;
  user_color: string;
  action_type: string;
  target_type: string;
  target_name: string;
  model_name: string;
  description: string;
  detail?: string | null;
};

export type ResetDataRequest = {
  seed_demo?: boolean;
};

export type ResetDataResponse = {
  status: string;
  seed_demo: boolean;
  models_count: number;
};
