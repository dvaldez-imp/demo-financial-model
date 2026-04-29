from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from app.schemas.domain import (
    DependencyRelation,
    DependencyType,
    Frequency,
    PeriodRecord,
    PredictionConfig,
    PremiseSource,
    ValueOrigin,
    YearSummaryMethod,
)


class ActivityLogEntryOut(BaseModel):
    id: str
    timestamp: str
    user: str
    user_initials: str
    user_color: str
    action_type: str
    target_type: str
    target_name: str
    model_name: str
    description: str
    detail: str | None = None


class CreateActivityLogRequest(BaseModel):
    user: str
    user_initials: str
    user_color: str
    action_type: str
    target_type: str
    target_name: str
    model_name: str
    description: str
    detail: str | None = None


class HealthResponse(BaseModel):
    status: str = "ok"


class ResetDataRequest(BaseModel):
    seed_demo: bool = True


class ResetDataResponse(BaseModel):
    status: str = "ok"
    seed_demo: bool
    models_count: int


class PredictionConfigOut(PredictionConfig):
    method_label: str


class ModelOut(BaseModel):
    id: str
    name: str
    frequency: Frequency = "monthly"
    actuals_end_period_key: str | None = None
    forecast_end_period_key: str | None = None


class CreateModelRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    frequency: Frequency = "monthly"
    actuals_end_period_key: str | None = None
    forecast_end_period_key: str | None = None


class UpdateTimelineRequest(BaseModel):
    actuals_end_period_key: str
    forecast_end_period_key: str


class PremiseOut(BaseModel):
    id: str
    model_id: str
    name: str
    variable_name: str
    unit: str | None = None
    category: str | None = None
    source: PremiseSource
    source_label: str
    source_ref_id: str | None = None
    dependency_type: DependencyType
    dependency_label: str
    source_model_id: str | None = None
    source_output_id: str | None = None
    year_summary_method: YearSummaryMethod
    year_summary_method_label: str
    prediction_base: PredictionConfigOut


class CreateLibraryPremiseRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    unit: str | None = None
    category: str | None = None
    prediction: PredictionConfig = Field(default_factory=PredictionConfig)


class CreateModelPremiseRequest(BaseModel):
    library_premise_id: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    unit: str | None = None
    category: str | None = None
    prediction_base: PredictionConfig = Field(default_factory=PredictionConfig)
    dependency_type: DependencyType = "none"
    source_ref_id: str | None = None
    source_model_id: str | None = None
    source_output_id: str | None = None

    @model_validator(mode="after")
    def validate_shape(self) -> "CreateModelPremiseRequest":
        has_library = bool(self.library_premise_id)
        has_local = bool(self.name)
        if has_library == has_local:
            raise ValueError("Provide either library_premise_id or a local premise payload.")
        return self


class UpdatePremiseRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    variable_name: str | None = Field(default=None, min_length=1, max_length=120)
    unit: str | None = None
    category: str | None = None
    dependency_type: DependencyType | None = None
    source_ref_id: str | None = None
    source_model_id: str | None = None
    source_output_id: str | None = None


class UpdatePredictionConfigRequest(BaseModel):
    base: PredictionConfig | None = None
    scenario_override: ScenarioPredictionOverridePayload | None = None


class UpdateYearSummaryConfigRequest(BaseModel):
    year_summary_method: YearSummaryMethod


class UpdateVariableNameRequest(BaseModel):
    variable_name: str = Field(min_length=1, max_length=120)


class ScenarioPredictionOverridePayload(PredictionConfig):
    scenario_id: str


class ScenarioOut(BaseModel):
    id: str
    model_id: str
    name: str
    description: str | None = None


class CreateScenarioRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class UpdateScenarioRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None


class ImportGridRequest(BaseModel):
    raw_text: str = Field(min_length=1)


class ImportedRowOut(BaseModel):
    premise_name: str
    values: dict[str, float | None]


class ImportGridResponse(BaseModel):
    detected_periods: list[PeriodRecord]
    rows: list[ImportedRowOut]
    created_premises: list[str]
    updated_premises: list[str]


class BoardModelOut(ModelOut):
    pass


class BoardScenarioOut(BaseModel):
    id: str
    name: str


class BoardValueOut(BaseModel):
    period_key: str
    value: float | None = None
    value_origin: ValueOrigin
    value_origin_label: str
    editable: bool


class BoardPremiseOut(BaseModel):
    id: str
    name: str
    variable_name: str
    unit: str | None = None
    category: str | None = None
    source: PremiseSource
    source_label: str
    source_ref_id: str | None = None
    dependency_type: DependencyType
    dependency_label: str
    source_model_id: str | None = None
    source_output_id: str | None = None
    year_summary_method: YearSummaryMethod
    year_summary_method_label: str
    prediction_base: PredictionConfigOut
    prediction_override: PredictionConfigOut | None = None
    values: list[BoardValueOut]


class YearGroupOut(BaseModel):
    year: int
    summary_period_key: str
    month_period_keys: list[str]


class ModelOutputOut(BaseModel):
    id: str
    model_id: str
    name: str
    display_name: str
    source_premise_id: str | None = None
    source_metric_key: str | None = None
    description: str | None = None
    active: bool


class BoardResponse(BaseModel):
    model: BoardModelOut
    periods: list[PeriodRecord]
    year_groups: list[YearGroupOut]
    scenarios: list[BoardScenarioOut]
    selected_scenario_id: str
    premises: list[BoardPremiseOut]
    exported_outputs: list[ModelOutputOut]


class CreateOutputRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    display_name: str = Field(min_length=1, max_length=200)
    source_premise_id: str | None = None
    source_metric_key: str | None = None
    description: str | None = None


class UpdateOutputRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    source_premise_id: str | None = None
    source_metric_key: str | None = None
    description: str | None = None
    active: bool | None = None


class CatalogModelOutputOut(ModelOutputOut):
    model_name: str


class CreatePremiseFromOutputRequest(BaseModel):
    output_id: str
    name_override: str | None = Field(default=None, min_length=1, max_length=200)


class DependencyNodeOut(BaseModel):
    id: str
    type: str
    name: str
    model_id: str | None = None
    model_name: str | None = None


class DependencyEdgeOut(BaseModel):
    from_type: str
    from_id: str
    to_type: str
    to_id: str
    relation: DependencyRelation


class DependenciesResponse(BaseModel):
    nodes: list[DependencyNodeOut]
    edges: list[DependencyEdgeOut]


class DependencyTreeRootOut(BaseModel):
    id: str
    type: str
    name: str


class DependencyTreeResponse(BaseModel):
    root: DependencyTreeRootOut
    nodes: list[DependencyNodeOut]
    edges: list[DependencyEdgeOut]
    unique_dependencies: list[DependencyNodeOut]
