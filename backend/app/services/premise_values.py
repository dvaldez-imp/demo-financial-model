from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException

from app.repositories.base import FinancialRepository
from app.schemas.api import BoardValueOut
from app.schemas.domain import ModelPremiseRecord, ModelRecord, PeriodRecord, PremiseValueRecord
from app.services.predictions import FormulaEvaluationError, evaluate_formula, extract_formula_variables, project_value
from app.utils.labels import VALUE_ORIGIN_LABELS


@dataclass
class ModelContext:
    model: ModelRecord
    periods: list[PeriodRecord]
    premises: list[ModelPremiseRecord]
    outputs: dict[str, object]
    base_scenario_id: str
    values_by_scenario_premise: dict[tuple[str, str], dict[str, PremiseValueRecord]]


def effective_record(
    period_key: str,
    selected: dict[str, PremiseValueRecord],
    base: dict[str, PremiseValueRecord],
) -> PremiseValueRecord | None:
    return selected.get(period_key) or base.get(period_key)


class PremiseValueResolver:
    def __init__(self, repository: FinancialRepository) -> None:
        self.repository = repository
        self.contexts: dict[str, ModelContext] = {}
        self.premise_cache: dict[tuple[str, str, str], list[BoardValueOut]] = {}

    def get_context(self, model_id: str) -> ModelContext:
        if model_id not in self.contexts:
            self.contexts[model_id] = self._build_context(model_id)
        return self.contexts[model_id]

    def resolve(
        self,
        premise: ModelPremiseRecord,
        scenario_id: str,
        *,
        context: ModelContext | None = None,
    ) -> list[BoardValueOut]:
        active_context = context or self.get_context(premise.model_id)
        cache_key = (active_context.model.id, premise.id, scenario_id)
        if cache_key in self.premise_cache:
            return self.premise_cache[cache_key]

        if premise.source == "model_output" and premise.source_output_id:
            output = self.repository.get_output(premise.source_output_id)
            if output is None or output.source_premise_id is None:
                values = [
                    BoardValueOut(
                        period_key=period.key,
                        value=None,
                        value_origin="forecast_generated",
                        value_origin_label=VALUE_ORIGIN_LABELS["forecast_generated"],
                        editable=False,
                    )
                    for period in active_context.periods
                ]
                self.premise_cache[cache_key] = values
                return values
            source_context = self.get_context(output.model_id)
            source_premise = self.repository.get_model_premise(output.source_premise_id)
            if source_premise is None:
                values = [
                    BoardValueOut(
                        period_key=period.key,
                        value=None,
                        value_origin="forecast_generated",
                        value_origin_label=VALUE_ORIGIN_LABELS["forecast_generated"],
                        editable=False,
                    )
                    for period in active_context.periods
                ]
                self.premise_cache[cache_key] = values
                return values
            source_values = self.resolve(source_premise, source_context.base_scenario_id, context=source_context)
            source_by_key = {value.period_key: value for value in source_values}
            values = [
                BoardValueOut(
                    period_key=period.key,
                    value=source_by_key.get(period.key).value if period.key in source_by_key else None,
                    value_origin=source_by_key.get(period.key).value_origin if period.key in source_by_key else "forecast_generated",
                    value_origin_label=source_by_key.get(period.key).value_origin_label if period.key in source_by_key else VALUE_ORIGIN_LABELS["forecast_generated"],
                    editable=False,
                )
                for period in active_context.periods
            ]
            self.premise_cache[cache_key] = values
            return values

        selected_records = active_context.values_by_scenario_premise.get((scenario_id, premise.id), {})
        base_records = active_context.values_by_scenario_premise.get((active_context.base_scenario_id, premise.id), {})
        overrides = self.repository.get_prediction_overrides(scenario_id) if scenario_id != active_context.base_scenario_id else {}
        prediction = overrides.get(premise.id, premise.prediction_base)
        is_formula_prediction = prediction.method == "formula_placeholder"
        expression = str(prediction.params.get("expression", "")).strip() if is_formula_prediction else ""
        formula_variables = extract_formula_variables(expression) if expression else set()
        premises_by_variable = {item.variable_name: item for item in active_context.premises}

        month_values: dict[str, BoardValueOut] = {}
        history: list[float | None] = []
        for period in active_context.periods:
            if period.type != "month":
                continue
            explicit = effective_record(period.key, selected_records, base_records)
            if period.zone == "historical":
                if explicit is not None:
                    month_values[period.key] = BoardValueOut(
                        period_key=period.key,
                        value=explicit.value,
                        value_origin=explicit.value_origin,
                        value_origin_label=VALUE_ORIGIN_LABELS[explicit.value_origin],
                        editable=explicit.editable,
                    )
                    history.append(explicit.value)
                elif is_formula_prediction and expression:
                    computed = self._evaluate_formula(
                        context=active_context,
                        premise=premise,
                        scenario_id=scenario_id,
                        expression=expression,
                        formula_variables=formula_variables,
                        premises_by_variable=premises_by_variable,
                        period_key=period.key,
                    )
                    month_values[period.key] = BoardValueOut(
                        period_key=period.key,
                        value=computed,
                        value_origin="forecast_generated",
                        value_origin_label=VALUE_ORIGIN_LABELS["forecast_generated"],
                        editable=False,
                    )
                    history.append(computed)
                else:
                    month_values[period.key] = BoardValueOut(
                        period_key=period.key,
                        value=None,
                        value_origin="actual",
                        value_origin_label=VALUE_ORIGIN_LABELS["actual"],
                        editable=True,
                    )
                    history.append(None)
                continue

            if explicit is not None:
                month_values[period.key] = BoardValueOut(
                    period_key=period.key,
                    value=explicit.value,
                    value_origin=explicit.value_origin,
                    value_origin_label=VALUE_ORIGIN_LABELS[explicit.value_origin],
                    editable=explicit.editable,
                )
                history.append(explicit.value)
                continue

            if is_formula_prediction and expression:
                computed = self._evaluate_formula(
                    context=active_context,
                    premise=premise,
                    scenario_id=scenario_id,
                    expression=expression,
                    formula_variables=formula_variables,
                    premises_by_variable=premises_by_variable,
                    period_key=period.key,
                )
                month_values[period.key] = BoardValueOut(
                    period_key=period.key,
                    value=computed,
                    value_origin="forecast_generated",
                    value_origin_label=VALUE_ORIGIN_LABELS["forecast_generated"],
                    editable=False,
                )
                history.append(computed)
                continue

            if prediction.method == "manual":
                month_values[period.key] = BoardValueOut(
                    period_key=period.key,
                    value=None,
                    value_origin="forecast_manual",
                    value_origin_label=VALUE_ORIGIN_LABELS["forecast_manual"],
                    editable=True,
                )
                history.append(None)
                continue

            value = project_value(prediction, history)
            month_values[period.key] = BoardValueOut(
                period_key=period.key,
                value=value,
                value_origin="forecast_generated",
                value_origin_label=VALUE_ORIGIN_LABELS["forecast_generated"],
                editable=False,
            )
            history.append(value)

        rendered_values: list[BoardValueOut] = []
        for period in active_context.periods:
            if period.type == "month":
                rendered_values.append(month_values[period.key])
                continue
            explicit_summary = effective_record(period.key, selected_records, base_records)
            if explicit_summary is not None:
                rendered_values.append(
                    BoardValueOut(
                        period_key=period.key,
                        value=explicit_summary.value,
                        value_origin="year_summary",
                        value_origin_label=VALUE_ORIGIN_LABELS["year_summary"],
                        editable=False,
                    )
                )
                continue

            total = 0.0
            has_value = False
            count = 0
            for month_key, month_value in month_values.items():
                if month_key.startswith(f"{period.year:04d}-") and month_value.value is not None:
                    total += month_value.value
                    has_value = True
                    count += 1

            summary_value: float | None
            if premise.year_summary_method == "avg":
                summary_value = (total / count) if count > 0 else None
            elif premise.year_summary_method == "last_value":
                summary_value = None
                year_months = [key for key in month_values if key.startswith(f"{period.year:04d}-")]
                for month_key in sorted(year_months, reverse=True):
                    candidate = month_values[month_key].value
                    if candidate is not None:
                        summary_value = candidate
                        break
            else:
                summary_value = total if has_value else None

            rendered_values.append(
                BoardValueOut(
                    period_key=period.key,
                    value=summary_value,
                    value_origin="year_summary",
                    value_origin_label=VALUE_ORIGIN_LABELS["year_summary"],
                    editable=False,
                )
            )

        self.premise_cache[cache_key] = rendered_values
        return rendered_values

    def _build_context(self, model_id: str) -> ModelContext:
        model = self.repository.get_model(model_id)
        if model is None:
            raise HTTPException(status_code=404, detail="Model not found.")
        base_scenario = self.repository.get_base_scenario(model_id)
        if base_scenario is None:
            raise HTTPException(status_code=400, detail="Model has no base scenario.")
        values_by_scenario_premise: dict[tuple[str, str], dict[str, PremiseValueRecord]] = {}
        for value in self.repository.list_values_for_model(model_id):
            values_by_scenario_premise.setdefault((value.scenario_id, value.premise_id), {})[value.period_key] = value
        return ModelContext(
            model=model,
            periods=self.repository.list_periods(model_id),
            premises=self.repository.list_model_premises(model_id),
            outputs={output.id: output for output in self.repository.list_outputs(model_id)},
            base_scenario_id=base_scenario.id,
            values_by_scenario_premise=values_by_scenario_premise,
        )

    def _evaluate_formula(
        self,
        *,
        context: ModelContext,
        premise: ModelPremiseRecord,
        scenario_id: str,
        expression: str,
        formula_variables: set[str],
        premises_by_variable: dict[str, ModelPremiseRecord],
        period_key: str,
    ) -> float | None:
        variable_values: dict[str, float | None] = {}
        for variable in formula_variables:
            source_premise = premises_by_variable.get(variable)
            if source_premise is None or source_premise.id == premise.id:
                variable_values[variable] = None
                continue
            source_values = self.resolve(source_premise, scenario_id, context=context)
            source_by_key = {value.period_key: value.value for value in source_values}
            variable_values[variable] = source_by_key.get(period_key)
        try:
            return evaluate_formula(expression, variable_values)
        except (FormulaEvaluationError, SyntaxError):
            return None
