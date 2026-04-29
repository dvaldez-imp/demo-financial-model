from __future__ import annotations

from fastapi import HTTPException

from app.repositories.base import FinancialRepository
from app.schemas.api import (
    BoardValueOut,
    CreateLibraryPremiseRequest,
    CreateModelPremiseRequest,
    CreateModelRequest,
    CreateScenarioRequest,
    ModelOut,
    PredictionConfigOut,
    PremiseOut,
    ScenarioOut,
    UpdateYearSummaryConfigRequest,
    UpdateVariableNameRequest,
    UpdatePredictionConfigRequest,
    UpdatePremiseRequest,
    UpdateScenarioRequest,
    UpdateTimelineRequest,
)
from app.schemas.domain import LibraryPremiseRecord, ModelPremiseRecord, ModelRecord, PredictionConfig, PremiseValueRecord, ScenarioRecord
from app.services.ids import generate_id
from app.services.period_parser import is_valid_variable_name, normalize_text, to_variable_name
from app.services.premise_values import PremiseValueResolver
from app.services.timeline import build_timeline_periods, compare_month_keys, shift_month
from app.services.dependencies import sync_formula_dependencies
from app.utils.labels import DEPENDENCY_LABELS, METHOD_LABELS, SOURCE_LABELS
from app.utils.labels import YEAR_SUMMARY_METHOD_LABELS


def _prediction_out(prediction: PredictionConfig) -> PredictionConfigOut:
    return PredictionConfigOut(**prediction.model_dump(), method_label=METHOD_LABELS[prediction.method])


def _model_out(model: ModelRecord) -> ModelOut:
    return ModelOut(**model.model_dump())


def _premise_out(premise: ModelPremiseRecord) -> PremiseOut:
    return PremiseOut(
        id=premise.id,
        model_id=premise.model_id,
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
    )


def _validate_prediction_window(prediction: PredictionConfig) -> None:
    start = prediction.forecast_start_period_key
    end = prediction.forecast_end_period_key
    if start and end and compare_month_keys(start, end) > 0:
        raise HTTPException(status_code=400, detail="forecast_start_period_key must be before forecast_end_period_key.")


def _validate_variable_name(variable_name: str) -> str:
    normalized = variable_name.strip().lower()
    if not is_valid_variable_name(normalized):
        raise HTTPException(status_code=400, detail="variable_name must use lowercase letters, numbers, and underscore, without spaces.")
    return normalized


def _validate_unique_model_variable_name(
    repository: FinancialRepository,
    *,
    model_id: str,
    variable_name: str,
    exclude_premise_id: str | None = None,
) -> None:
    for premise in repository.list_model_premises(model_id):
        if exclude_premise_id and premise.id == exclude_premise_id:
            continue
        if premise.variable_name == variable_name:
            raise HTTPException(status_code=400, detail="Another premise already uses that variable_name in this model.")


def _validate_unique_library_variable_name(
    repository: FinancialRepository,
    *,
    variable_name: str,
    exclude_premise_id: str | None = None,
) -> None:
    for premise in repository.list_library_premises():
        if exclude_premise_id and premise.id == exclude_premise_id:
            continue
        if premise.variable_name == variable_name:
            raise HTTPException(status_code=400, detail="Another library premise already uses that variable_name.")


def _with_model_forecast_window(model: ModelRecord, prediction: PredictionConfig) -> PredictionConfig:
    data = prediction.model_dump()
    if data["forecast_end_period_key"] is None:
        data["forecast_end_period_key"] = model.forecast_end_period_key
    if data["forecast_start_period_key"] is None and model.actuals_end_period_key:
        if data["forecast_end_period_key"] and compare_month_keys(model.actuals_end_period_key, data["forecast_end_period_key"]) < 0:
            data["forecast_start_period_key"] = shift_month(model.actuals_end_period_key)
        else:
            data["forecast_start_period_key"] = data["forecast_end_period_key"]
    candidate = PredictionConfig.model_validate(data)
    _validate_prediction_window(candidate)
    return candidate


def _materialize_forecast_as_manual(
    repository: FinancialRepository,
    *,
    premise: ModelPremiseRecord,
    scenario_id: str,
    rendered_values: list[BoardValueOut],
) -> None:
    forecast_month_keys = {
        period.key
        for period in repository.list_periods(premise.model_id)
        if period.type == "month" and period.zone == "forecast"
    }
    values_to_upsert = [
        PremiseValueRecord(
            premise_id=premise.id,
            period_key=value.period_key,
            scenario_id=scenario_id,
            value=value.value,
            value_origin="forecast_manual",
            editable=True,
        )
        for value in rendered_values
        if value.period_key in forecast_month_keys and value.value is not None
    ]
    if values_to_upsert:
        repository.upsert_values(values=values_to_upsert)


def list_models(repository: FinancialRepository) -> list[ModelOut]:
    return [_model_out(model) for model in repository.list_models()]


def get_model(repository: FinancialRepository, model_id: str) -> ModelOut:
    model = repository.get_model(model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found.")
    return _model_out(model)


def create_model(repository: FinancialRepository, payload: CreateModelRequest) -> ModelOut:
    actuals_end = payload.actuals_end_period_key
    forecast_end = payload.forecast_end_period_key or actuals_end
    if actuals_end and forecast_end and compare_month_keys(actuals_end, forecast_end) > 0:
        raise HTTPException(status_code=400, detail="actuals_end_period_key must be before forecast_end_period_key.")

    model = ModelRecord(
        id=generate_id("model"),
        name=payload.name.strip(),
        frequency=payload.frequency,
        actuals_end_period_key=actuals_end,
        forecast_end_period_key=forecast_end,
    )
    repository.create_model(model=model)
    repository.create_scenario(
        scenario=ScenarioRecord(
            id=generate_id("scn"),
            model_id=model.id,
            name="Base",
            description="Base scenario",
            is_base=True,
        )
    )
    if model.actuals_end_period_key or model.forecast_end_period_key:
        repository.replace_periods(
            model_id=model.id,
            periods=build_timeline_periods(
                existing_periods=[],
                actuals_end_period_key=model.actuals_end_period_key,
                forecast_end_period_key=model.forecast_end_period_key,
            ),
        )
    return _model_out(model)


def update_model_timeline(
    repository: FinancialRepository,
    model_id: str,
    payload: UpdateTimelineRequest,
) -> ModelOut:
    model = repository.get_model(model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found.")
    if compare_month_keys(payload.actuals_end_period_key, payload.forecast_end_period_key) > 0:
        raise HTTPException(status_code=400, detail="actuals_end_period_key must be before forecast_end_period_key.")

    updated = repository.update_model(
        model_id=model_id,
        changes={
            "actuals_end_period_key": payload.actuals_end_period_key,
            "forecast_end_period_key": payload.forecast_end_period_key,
        },
    )
    assert updated is not None
    repository.replace_periods(
        model_id=model_id,
        periods=build_timeline_periods(
            existing_periods=repository.list_periods(model_id),
            actuals_end_period_key=updated.actuals_end_period_key,
            forecast_end_period_key=updated.forecast_end_period_key,
        ),
    )
    return _model_out(updated)


def list_library_premises(repository: FinancialRepository) -> list[PremiseOut]:
    return [
        PremiseOut(
            id=premise.id,
            model_id="library",
            name=premise.name,
            variable_name=premise.variable_name,
            unit=premise.unit,
            category=premise.category,
            source="library",
            source_label=SOURCE_LABELS["library"],
            source_ref_id=premise.id,
            dependency_type="none",
            dependency_label=DEPENDENCY_LABELS["none"],
            source_model_id=None,
            source_output_id=None,
            year_summary_method="sum",
            year_summary_method_label=YEAR_SUMMARY_METHOD_LABELS["sum"],
            prediction_base=_prediction_out(premise.prediction),
        )
        for premise in repository.list_library_premises()
    ]


def create_library_premise(repository: FinancialRepository, payload: CreateLibraryPremiseRequest) -> PremiseOut:
    normalized_name = normalize_text(payload.name)
    for premise in repository.list_library_premises():
        if premise.normalized_name == normalized_name:
            raise HTTPException(status_code=400, detail="Library premise already exists.")
    variable_name = to_variable_name(payload.name)
    _validate_unique_library_variable_name(repository, variable_name=variable_name)
    record = LibraryPremiseRecord(
        id=generate_id("lib"),
        name=payload.name.strip(),
        normalized_name=normalized_name,
        variable_name=variable_name,
        unit=payload.unit,
        category=payload.category,
        prediction=payload.prediction,
    )
    repository.create_library_premise(premise=record)
    return list_library_premises(repository)[-1]


def create_model_premise(
    repository: FinancialRepository,
    model_id: str,
    payload: CreateModelPremiseRequest,
) -> PremiseOut:
    model = repository.get_model(model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found.")

    if payload.library_premise_id:
        library_premise = repository.get_library_premise(payload.library_premise_id)
        if library_premise is None:
            raise HTTPException(status_code=404, detail="Library premise not found.")
        if repository.find_model_premise_by_normalized_name(model_id=model_id, normalized_name=library_premise.normalized_name):
            raise HTTPException(status_code=400, detail="Model premise already exists.")
        _validate_unique_model_variable_name(repository, model_id=model_id, variable_name=library_premise.variable_name)
        record = ModelPremiseRecord(
            id=generate_id("prem"),
            model_id=model_id,
            name=library_premise.name,
            normalized_name=library_premise.normalized_name,
            variable_name=library_premise.variable_name,
            unit=library_premise.unit,
            category=library_premise.category,
            source="library",
            source_ref_id=library_premise.id,
            dependency_type="none",
            source_model_id=None,
            source_output_id=None,
            prediction_base=_with_model_forecast_window(model, library_premise.prediction),
        )
    else:
        normalized_name = normalize_text(payload.name or "")
        if repository.find_model_premise_by_normalized_name(model_id=model_id, normalized_name=normalized_name):
            raise HTTPException(status_code=400, detail="Model premise already exists.")
        variable_name = to_variable_name(payload.name or "")
        _validate_unique_model_variable_name(repository, model_id=model_id, variable_name=variable_name)
        record = ModelPremiseRecord(
            id=generate_id("prem"),
            model_id=model_id,
            name=(payload.name or "").strip(),
            normalized_name=normalized_name,
            variable_name=variable_name,
            unit=payload.unit,
            category=payload.category,
            source="local",
            source_ref_id=payload.source_ref_id,
            dependency_type=payload.dependency_type,
            source_model_id=payload.source_model_id,
            source_output_id=payload.source_output_id,
            prediction_base=_with_model_forecast_window(model, payload.prediction_base),
        )

    repository.create_model_premise(premise=record)
    if record.prediction_base.method == "formula_placeholder":
        expression = str(record.prediction_base.params.get("expression", ""))
        sync_formula_dependencies(
            repository,
            model_id=model_id,
            target_premise_id=record.id,
            expression=expression,
        )
    return _premise_out(record)


def update_premise(
    repository: FinancialRepository,
    premise_id: str,
    payload: UpdatePremiseRequest,
) -> PremiseOut:
    premise = repository.get_model_premise(premise_id)
    if premise is None:
        raise HTTPException(status_code=404, detail="Premise not found.")

    changes: dict[str, object] = {}
    if "name" in payload.model_fields_set:
        normalized_name = normalize_text(payload.name or "")
        existing = repository.find_model_premise_by_normalized_name(model_id=premise.model_id, normalized_name=normalized_name)
        if existing is not None and existing.id != premise.id:
            raise HTTPException(status_code=400, detail="Another premise already uses that name.")
        changes["name"] = (payload.name or "").strip()
        changes["normalized_name"] = normalized_name
    if "variable_name" in payload.model_fields_set and payload.variable_name is not None:
        variable_name = _validate_variable_name(payload.variable_name)
        _validate_unique_model_variable_name(
            repository,
            model_id=premise.model_id,
            variable_name=variable_name,
            exclude_premise_id=premise.id,
        )
        changes["variable_name"] = variable_name
    for field in ["unit", "category", "dependency_type", "source_ref_id", "source_model_id", "source_output_id"]:
        if field in payload.model_fields_set:
            changes[field] = getattr(payload, field)

    updated = repository.update_model_premise(premise_id=premise_id, changes=changes)
    if updated is None:
        raise HTTPException(status_code=404, detail="Premise not found.")
    return _premise_out(updated)


def update_prediction_config(
    repository: FinancialRepository,
    premise_id: str,
    payload: UpdatePredictionConfigRequest,
) -> PremiseOut:
    premise = repository.get_model_premise(premise_id)
    if premise is None:
        raise HTTPException(status_code=404, detail="Premise not found.")
    model = repository.get_model(premise.model_id)
    assert model is not None
    base_scenario = repository.get_base_scenario(premise.model_id)
    assert base_scenario is not None
    resolver = PremiseValueResolver(repository)

    base_values_to_materialize = None
    if payload.base is not None:
        updated_prediction = _with_model_forecast_window(model, payload.base)
        if updated_prediction.method == "manual" and premise.prediction_base.method != "manual":
            base_values_to_materialize = resolver.resolve(premise, base_scenario.id)
        repository.update_model_premise(
            premise_id=premise_id,
            changes={"prediction_base": updated_prediction},
        )
        if updated_prediction.method == "formula_placeholder":
            sync_formula_dependencies(
                repository,
                model_id=premise.model_id,
                target_premise_id=premise_id,
                expression=str(updated_prediction.params.get("expression", "")),
            )
        else:
            repository.delete_dependency_edges(to_type="premise", to_id=premise_id, relation="derives_from")
        if base_values_to_materialize is not None:
            _materialize_forecast_as_manual(
                repository,
                premise=premise,
                scenario_id=base_scenario.id,
                rendered_values=base_values_to_materialize,
            )

    if payload.scenario_override is not None:
        scenario = repository.get_scenario(payload.scenario_override.scenario_id)
        if scenario is None or scenario.model_id != premise.model_id:
            raise HTTPException(status_code=400, detail="Scenario does not belong to the premise model.")
        override_config = PredictionConfig.model_validate(payload.scenario_override.model_dump(exclude={"scenario_id"}))
        _validate_prediction_window(override_config)
        current_override = repository.get_prediction_overrides(scenario.id).get(premise_id, premise.prediction_base)
        override_values_to_materialize = None
        if override_config.method == "manual" and current_override.method != "manual":
            override_values_to_materialize = resolver.resolve(premise, scenario.id)
        repository.upsert_prediction_overrides(
            scenario_id=scenario.id,
            overrides={premise_id: _with_model_forecast_window(model, override_config)},
        )
        if override_values_to_materialize is not None:
            _materialize_forecast_as_manual(
                repository,
                premise=premise,
                scenario_id=scenario.id,
                rendered_values=override_values_to_materialize,
            )

    updated = repository.get_model_premise(premise_id)
    assert updated is not None
    return _premise_out(updated)


def list_scenarios(repository: FinancialRepository, model_id: str) -> list[ScenarioOut]:
    if repository.get_model(model_id) is None:
        raise HTTPException(status_code=404, detail="Model not found.")
    return [ScenarioOut(id=scenario.id, model_id=scenario.model_id, name=scenario.name, description=scenario.description) for scenario in repository.list_scenarios(model_id)]


def create_scenario(repository: FinancialRepository, model_id: str, payload: CreateScenarioRequest) -> ScenarioOut:
    if repository.get_model(model_id) is None:
        raise HTTPException(status_code=404, detail="Model not found.")
    scenario = ScenarioRecord(id=generate_id("scn"), model_id=model_id, name=payload.name.strip(), description=payload.description, is_base=False)
    repository.create_scenario(scenario=scenario)
    return ScenarioOut(id=scenario.id, model_id=scenario.model_id, name=scenario.name, description=scenario.description)


def update_scenario(repository: FinancialRepository, scenario_id: str, payload: UpdateScenarioRequest) -> ScenarioOut:
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        changes["name"] = str(changes["name"]).strip()
    updated = repository.update_scenario(scenario_id=scenario_id, changes=changes)
    if updated is None:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    return ScenarioOut(id=updated.id, model_id=updated.model_id, name=updated.name, description=updated.description)


def update_year_summary_config(
    repository: FinancialRepository,
    premise_id: str,
    payload: UpdateYearSummaryConfigRequest,
) -> PremiseOut:
    premise = repository.get_model_premise(premise_id)
    if premise is None:
        raise HTTPException(status_code=404, detail="Premise not found.")
    updated = repository.update_model_premise(
        premise_id=premise_id,
        changes={"year_summary_method": payload.year_summary_method},
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Premise not found.")
    return _premise_out(updated)


def update_model_premise_variable_name(
    repository: FinancialRepository,
    premise_id: str,
    payload: UpdateVariableNameRequest,
) -> PremiseOut:
    premise = repository.get_model_premise(premise_id)
    if premise is None:
        raise HTTPException(status_code=404, detail="Premise not found.")
    variable_name = _validate_variable_name(payload.variable_name)
    _validate_unique_model_variable_name(
        repository,
        model_id=premise.model_id,
        variable_name=variable_name,
        exclude_premise_id=premise.id,
    )
    updated = repository.update_model_premise(
        premise_id=premise_id,
        changes={"variable_name": variable_name},
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Premise not found.")
    for candidate in repository.list_model_premises(premise.model_id):
        prediction = candidate.prediction_base
        if prediction.method == "formula_placeholder":
            sync_formula_dependencies(
                repository,
                model_id=premise.model_id,
                target_premise_id=candidate.id,
                expression=str(prediction.params.get("expression", "")),
            )
    return _premise_out(updated)


def update_library_premise_variable_name(
    repository: FinancialRepository,
    premise_id: str,
    payload: UpdateVariableNameRequest,
) -> PremiseOut:
    premise = repository.get_library_premise(premise_id)
    if premise is None:
        raise HTTPException(status_code=404, detail="Library premise not found.")
    variable_name = _validate_variable_name(payload.variable_name)
    _validate_unique_library_variable_name(
        repository,
        variable_name=variable_name,
        exclude_premise_id=premise.id,
    )
    updated = repository.update_library_premise(
        premise_id=premise_id,
        changes={"variable_name": variable_name},
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Library premise not found.")
    return PremiseOut(
        id=updated.id,
        model_id="library",
        name=updated.name,
        variable_name=updated.variable_name,
        unit=updated.unit,
        category=updated.category,
        source="library",
        source_label=SOURCE_LABELS["library"],
        source_ref_id=updated.id,
        dependency_type="none",
        dependency_label=DEPENDENCY_LABELS["none"],
        source_model_id=None,
        source_output_id=None,
        year_summary_method="sum",
        year_summary_method_label=YEAR_SUMMARY_METHOD_LABELS["sum"],
        prediction_base=_prediction_out(updated.prediction),
    )


def _build_graph(edges: list[tuple[str, str]]) -> dict[str, set[str]]:
    graph: dict[str, set[str]] = {}
    for source, target in edges:
        graph.setdefault(source, set()).add(target)
    return graph


def _reachable_nodes(start: str, graph: dict[str, set[str]]) -> set[str]:
    visited: set[str] = set()
    stack = [start]
    while stack:
        node = stack.pop()
        for nxt in graph.get(node, set()):
            if nxt in visited:
                continue
            visited.add(nxt)
            stack.append(nxt)
    return visited


def delete_premise(repository: FinancialRepository, model_id: str, premise_id: str) -> None:
    premise = repository.get_model_premise(premise_id)
    if premise is None or premise.model_id != model_id:
        raise HTTPException(status_code=404, detail="Premise not found.")

    premise_node = f"premise:{premise_id}"
    edge_pairs: list[tuple[str, str]] = []
    for edge in repository.list_dependency_edges():
        edge_pairs.append((f"{edge.from_type}:{edge.from_id}", f"{edge.to_type}:{edge.to_id}"))

    graph = _build_graph(edge_pairs)
    dependents = _reachable_nodes(premise_node, graph)
    dependents.discard(premise_node)
    if dependents:
        raise HTTPException(status_code=409, detail="Premise cannot be deleted because it has dependent premises or outputs.")

    has_linked_outputs = any(
        output.source_premise_id == premise_id
        for output in repository.list_outputs(model_id)
    )
    if has_linked_outputs:
        raise HTTPException(status_code=409, detail="Premise cannot be deleted because it is linked to model outputs.")

    deleted = repository.delete_model_premise(premise_id=premise_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Premise not found.")
