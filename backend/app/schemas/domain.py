from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

ActionType = Literal["crear", "editar", "eliminar", "importar", "guardar", "prediccion", "escenario"]
TargetType = Literal["premisa", "modelo", "escenario", "celda", "timeline", "prediccion", "grid"]

PredictionMethod = Literal[
    "manual",
    "carry_forward",
    "growth_rate_pct",
    "moving_average",
    "linear_trend",
    "seasonal_naive",
    "arima_like",
    "formula_placeholder",
]
PeriodType = Literal["month", "year_summary"]
PeriodZone = Literal["historical", "forecast", "summary"]
PremiseSource = Literal["local", "library", "model_output"]
DependencyType = Literal["none", "local_premise", "model_output"]
ValueOrigin = Literal["actual", "forecast_generated", "forecast_manual", "year_summary"]
Frequency = Literal["monthly"]
NodeType = Literal["premise", "model_output"]
DependencyRelation = Literal["uses", "derives_from", "exports"]
YearSummaryMethod = Literal["sum", "avg", "last_value"]


class PredictionConfig(BaseModel):
    method: PredictionMethod = "manual"
    params: dict[str, Any] = Field(default_factory=dict)
    forecast_start_period_key: str | None = None
    forecast_end_period_key: str | None = None


class ModelRecord(BaseModel):
    id: str
    name: str
    frequency: Frequency = "monthly"
    actuals_end_period_key: str | None = None
    forecast_end_period_key: str | None = None


class PeriodRecord(BaseModel):
    key: str
    label: str
    type: PeriodType
    year: int
    month: int | None = None
    zone: PeriodZone = "historical"


class LibraryPremiseRecord(BaseModel):
    id: str
    name: str
    normalized_name: str
    variable_name: str
    unit: str | None = None
    category: str | None = None
    prediction: PredictionConfig = Field(default_factory=PredictionConfig)


class ModelPremiseRecord(BaseModel):
    id: str
    model_id: str
    name: str
    normalized_name: str
    variable_name: str
    unit: str | None = None
    category: str | None = None
    source: PremiseSource = "local"
    source_ref_id: str | None = None
    dependency_type: DependencyType = "none"
    source_model_id: str | None = None
    source_output_id: str | None = None
    year_summary_method: YearSummaryMethod = "sum"
    prediction_base: PredictionConfig = Field(default_factory=PredictionConfig)


class ScenarioRecord(BaseModel):
    id: str
    model_id: str
    name: str
    description: str | None = None
    is_base: bool = False


class ScenarioPremiseOverrideRecord(BaseModel):
    scenario_id: str
    premise_id: str
    prediction_override: PredictionConfig


class PremiseValueRecord(BaseModel):
    premise_id: str
    period_key: str
    scenario_id: str
    value: float | None = None
    value_origin: ValueOrigin = "actual"
    editable: bool = True


class ModelOutputRecord(BaseModel):
    id: str
    model_id: str
    name: str
    display_name: str
    source_premise_id: str | None = None
    source_metric_key: str | None = None
    description: str | None = None
    active: bool = True


class DependencyEdgeRecord(BaseModel):
    from_type: NodeType
    from_id: str
    to_type: NodeType
    to_id: str
    relation: DependencyRelation


class ActivityLogRecord(BaseModel):
    id: str
    timestamp: str
    user: str
    user_initials: str
    user_color: str
    action_type: ActionType
    target_type: TargetType
    target_name: str
    model_name: str
    description: str
    detail: str | None = None
