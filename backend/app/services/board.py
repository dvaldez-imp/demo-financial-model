from __future__ import annotations

from fastapi import HTTPException

from app.repositories.base import FinancialRepository
from app.schemas.api import (
    BoardModelOut,
    BoardPremiseOut,
    BoardResponse,
    BoardScenarioOut,
    BoardValueOut,
    ModelOutputOut,
    YearGroupOut,
)
from app.schemas.domain import ModelPremiseRecord, PeriodRecord
from app.services.models import _prediction_out
from app.services.premise_values import PremiseValueResolver
from app.utils.labels import DEPENDENCY_LABELS, SOURCE_LABELS
from app.utils.labels import YEAR_SUMMARY_METHOD_LABELS


def _build_year_groups(periods: list[PeriodRecord]) -> list[YearGroupOut]:
    month_keys_by_year: dict[int, list[str]] = {}
    for period in periods:
        if period.type != "month":
            continue
        month_keys_by_year.setdefault(period.year, []).append(period.key)

    year_groups: list[YearGroupOut] = []
    for year in sorted(month_keys_by_year):
        year_groups.append(
            YearGroupOut(
                year=year,
                summary_period_key=str(year),
                month_period_keys=sorted(month_keys_by_year[year]),
            )
        )
    return year_groups
def build_board(
    repository: FinancialRepository,
    model_id: str,
    scenario_id: str | None = None,
) -> BoardResponse:
    resolver = PremiseValueResolver(repository)
    root_context = resolver.get_context(model_id)
    selected_scenario_id = scenario_id or root_context.base_scenario_id
    selected_scenario = repository.get_scenario(selected_scenario_id)
    if selected_scenario is None or selected_scenario.model_id != model_id:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    root_overrides = repository.get_prediction_overrides(selected_scenario_id)

    board_premises: list[BoardPremiseOut] = []
    for premise in root_context.premises:
        prediction_override = root_overrides.get(premise.id)
        board_premises.append(
            BoardPremiseOut(
                id=premise.id,
                name=premise.name,
                variable_name=premise.variable_name,
                unit=premise.unit,
                category=premise.category,
                source=premise.source,
                source_label=SOURCE_LABELS[premise.source],
                source_ref_id=premise.source_ref_id,
                dependency_type=premise.dependency_type,
                dependency_label=DEPENDENCY_LABELS[premise.dependency_type],
                source_model_id=premise.source_model_id,
                source_output_id=premise.source_output_id,
                year_summary_method=premise.year_summary_method,
                year_summary_method_label=YEAR_SUMMARY_METHOD_LABELS[premise.year_summary_method],
                prediction_base=_prediction_out(premise.prediction_base),
                prediction_override=_prediction_out(prediction_override) if prediction_override else None,
                values=resolver.resolve(premise, selected_scenario_id, context=root_context),
            )
        )

    return BoardResponse(
        model=BoardModelOut(**root_context.model.model_dump()),
        periods=root_context.periods,
        year_groups=_build_year_groups(root_context.periods),
        scenarios=[BoardScenarioOut(id=scenario.id, name=scenario.name) for scenario in repository.list_scenarios(model_id)],
        selected_scenario_id=selected_scenario_id,
        premises=board_premises,
        exported_outputs=[
            ModelOutputOut(
                id=output.id,
                model_id=output.model_id,
                name=output.name,
                display_name=output.display_name,
                source_premise_id=output.source_premise_id,
                source_metric_key=output.source_metric_key,
                description=output.description,
                active=output.active,
            )
            for output in repository.list_outputs(model_id)
        ],
    )
