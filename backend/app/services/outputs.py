from __future__ import annotations

from fastapi import HTTPException

from app.repositories.base import FinancialRepository
from app.schemas.api import (
    CatalogModelOutputOut,
    CreateOutputRequest,
    CreatePremiseFromOutputRequest,
    ModelOutputOut,
    PremiseOut,
    UpdateOutputRequest,
)
from app.schemas.domain import DependencyEdgeRecord, ModelOutputRecord, ModelPremiseRecord, PredictionConfig
from app.services.dependencies import would_create_cycle
from app.services.ids import generate_id
from app.services.models import _premise_out
from app.services.period_parser import normalize_text, to_variable_name
from app.services.timeline import shift_month


def _output_out(output: ModelOutputRecord) -> ModelOutputOut:
    return ModelOutputOut(**output.model_dump())


def list_model_outputs(repository: FinancialRepository, model_id: str) -> list[ModelOutputOut]:
    if repository.get_model(model_id) is None:
        raise HTTPException(status_code=404, detail="Model not found.")
    return [_output_out(output) for output in repository.list_outputs(model_id)]


def create_output(repository: FinancialRepository, model_id: str, payload: CreateOutputRequest) -> ModelOutputOut:
    if repository.get_model(model_id) is None:
        raise HTTPException(status_code=404, detail="Model not found.")
    if payload.source_premise_id is not None:
        premise = repository.get_model_premise(payload.source_premise_id)
        if premise is None or premise.model_id != model_id:
            raise HTTPException(status_code=400, detail="source_premise_id must belong to the same model.")
    output = ModelOutputRecord(
        id=generate_id("out"),
        model_id=model_id,
        name=payload.name.strip(),
        display_name=payload.display_name.strip(),
        source_premise_id=payload.source_premise_id,
        source_metric_key=payload.source_metric_key,
        description=payload.description,
        active=True,
    )
    edge: DependencyEdgeRecord | None = None
    if output.source_premise_id:
        edge = DependencyEdgeRecord(
            from_type="premise",
            from_id=output.source_premise_id,
            to_type="model_output",
            to_id=output.id,
            relation="exports",
        )
        if would_create_cycle(repository, edge):
            raise HTTPException(status_code=409, detail="Dependencia invalida: crearia un ciclo entre premisas.")
    repository.create_output(output=output)
    if edge is not None:
        repository.upsert_dependency_edge(edge=edge)
    return _output_out(output)


def update_output(repository: FinancialRepository, model_id: str, output_id: str, payload: UpdateOutputRequest) -> ModelOutputOut:
    output = repository.get_output(output_id)
    if output is None or output.model_id != model_id:
        raise HTTPException(status_code=404, detail="Output not found.")
    if payload.source_premise_id is not None:
        premise = repository.get_model_premise(payload.source_premise_id)
        if premise is None or premise.model_id != model_id:
            raise HTTPException(status_code=400, detail="source_premise_id must belong to the same model.")
        edge = DependencyEdgeRecord(
            from_type="premise",
            from_id=payload.source_premise_id,
            to_type="model_output",
            to_id=output_id,
            relation="exports",
        )
        if would_create_cycle(repository, edge):
            raise HTTPException(status_code=409, detail="Dependencia invalida: crearia un ciclo entre premisas.")
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        changes["name"] = str(changes["name"]).strip()
    if "display_name" in changes:
        changes["display_name"] = str(changes["display_name"]).strip()
    updated = repository.update_output(output_id=output_id, changes=changes)
    if updated is None:
        raise HTTPException(status_code=404, detail="Output not found.")
    if payload.source_premise_id is not None:
        repository.upsert_dependency_edge(
            edge=DependencyEdgeRecord(
                from_type="premise",
                from_id=payload.source_premise_id,
                to_type="model_output",
                to_id=output_id,
                relation="exports",
            )
        )
    return _output_out(updated)


def list_output_catalog(repository: FinancialRepository) -> list[CatalogModelOutputOut]:
    models = {model.id: model.name for model in repository.list_models()}
    return [
        CatalogModelOutputOut(**output.model_dump(), model_name=models.get(output.model_id, output.model_id))
        for output in repository.list_active_outputs()
    ]


def create_premise_from_output(
    repository: FinancialRepository,
    model_id: str,
    payload: CreatePremiseFromOutputRequest,
) -> PremiseOut:
    model = repository.get_model(model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found.")
    output = repository.get_output(payload.output_id)
    if output is None or not output.active:
        raise HTTPException(status_code=404, detail="Output not found.")
    source_premise = repository.get_model_premise(output.source_premise_id or "")
    if source_premise is None:
        raise HTTPException(status_code=400, detail="Output has no source premise.")

    premise_name = (payload.name_override or output.display_name).strip()
    normalized_name = normalize_text(premise_name)
    if repository.find_model_premise_by_normalized_name(model_id=model_id, normalized_name=normalized_name):
        raise HTTPException(status_code=400, detail="Model premise already exists.")
    variable_name = to_variable_name(premise_name)
    for candidate in repository.list_model_premises(model_id):
        if candidate.variable_name == variable_name:
            raise HTTPException(status_code=400, detail="Another premise already uses that variable_name in this model.")

    forecast_start = shift_month(model.actuals_end_period_key) if model.actuals_end_period_key else None
    premise = ModelPremiseRecord(
        id=generate_id("prem"),
        model_id=model_id,
        name=premise_name,
        normalized_name=normalized_name,
        variable_name=variable_name,
        unit=source_premise.unit,
        category=source_premise.category,
        source="model_output",
        source_ref_id=output.id,
        dependency_type="model_output",
        source_model_id=output.model_id,
        source_output_id=output.id,
        prediction_base=PredictionConfig(
            method="manual",
            params={},
            forecast_start_period_key=forecast_start,
            forecast_end_period_key=model.forecast_end_period_key,
        ),
    )
    edge = DependencyEdgeRecord(
        from_type="model_output",
        from_id=output.id,
        to_type="premise",
        to_id=premise.id,
        relation="uses",
    )
    if would_create_cycle(repository, edge):
        raise HTTPException(status_code=409, detail="Dependencia invalida: crearia un ciclo entre premisas.")
    repository.create_model_premise(premise=premise)
    repository.upsert_dependency_edge(edge=edge)
    return _premise_out(premise)
