from __future__ import annotations

from fastapi import HTTPException

from app.repositories.base import FinancialRepository
from app.schemas.api import (
    BoardModelOut,
    BoardPremiseOut,
    BoardResponse,
    BoardScenarioOut,
    BoardValueOut,
    CompositePremiseModeOut,
    CompositePremiseModeOverrideOut,
    ModelOutputOut,
    PremiseModeOut,
    YearGroupOut,
)
from app.schemas.domain import ModelPremiseRecord, PeriodRecord
from app.services.models import _prediction_out
from app.services.premise_values import PremiseValueResolver
from app.utils.labels import DEPENDENCY_LABELS, METHOD_LABELS, SOURCE_LABELS
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
def _mode_out(mode: object) -> PremiseModeOut:
    from app.schemas.domain import PremiseModeRecord
    assert isinstance(mode, PremiseModeRecord)
    return PremiseModeOut(
        id=mode.id,
        premise_id=mode.premise_id,
        name=mode.name,
        is_default=mode.is_default,
        prediction_config=_prediction_out(mode.prediction_config),
    )


def _composite_mode_out(mode: object) -> CompositePremiseModeOut:
    from app.schemas.domain import CompositePremiseModeRecord
    assert isinstance(mode, CompositePremiseModeRecord)
    return CompositePremiseModeOut(
        id=mode.id,
        premise_id=mode.premise_id,
        name=mode.name,
        is_default=mode.is_default,
        overrides=[CompositePremiseModeOverrideOut(premise_id=o["premise_id"], mode_id=o["mode_id"]) for o in mode.overrides],
        inherited_from_mode_id=mode.inherited_from_mode_id,
    )


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
    scenario_mode_map = repository.get_scenario_premise_modes(selected_scenario_id)

    board_premises: list[BoardPremiseOut] = []
    for premise in root_context.premises:
        if premise.dependency_type == "none":
            modes = [_mode_out(m) for m in repository.list_premise_modes(premise.id)]
            composite_modes: list[CompositePremiseModeOut] = []
            active_mode_id = scenario_mode_map.get(premise.id)
            if not active_mode_id:
                default = next((m for m in modes if m.is_default), None)
                active_mode_id = default.id if default else None
            default_mode = next((m for m in modes if m.is_default), None)
            prediction_base_config = default_mode.prediction_config if default_mode else _prediction_out(premise.prediction_base)
        else:
            modes = []
            composite_modes = [_composite_mode_out(m) for m in repository.list_composite_premise_modes(premise.id)]
            active_mode_id = scenario_mode_map.get(premise.id)
            if not active_mode_id:
                default_comp = next((m for m in composite_modes if m.is_default), None)
                active_mode_id = default_comp.id if default_comp else None
            prediction_base_config = _prediction_out(premise.prediction_base)

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
                prediction_base=prediction_base_config,
                modes=modes,
                composite_modes=composite_modes,
                active_mode_id=active_mode_id,
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
