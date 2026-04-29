from fastapi import APIRouter, Depends, Query

from app.api.deps import get_repository
from app.repositories.base import FinancialRepository
from app.schemas.api import (
    BoardResponse,
    CreateModelPremiseRequest,
    CreateModelRequest,
    CreateOutputRequest,
    CreatePremiseFromOutputRequest,
    CreateScenarioRequest,
    DependencyTreeResponse,
    DependenciesResponse,
    ImportGridRequest,
    ImportGridResponse,
    ModelOut,
    ModelOutputOut,
    PremiseOut,
    ScenarioOut,
    UpdateOutputRequest,
    UpdateTimelineRequest,
)
from app.services.board import build_board
from app.services.dependencies import get_model_dependencies
from app.services.import_grid import import_grid
from app.services.models import (
    create_model,
    create_model_premise,
    create_scenario,
    delete_premise,
    get_model,
    list_models,
    list_scenarios,
    update_model_timeline,
)
from app.services.outputs import create_output, create_premise_from_output, list_model_outputs, update_output
from app.services.dependencies import get_model_dependencies_tree

router = APIRouter(prefix="/models", tags=["models"])


@router.get("", response_model=list[ModelOut])
def get_models(repository: FinancialRepository = Depends(get_repository)) -> list[ModelOut]:
    return list_models(repository)


@router.post("", response_model=ModelOut, status_code=201)
def post_model(payload: CreateModelRequest, repository: FinancialRepository = Depends(get_repository)) -> ModelOut:
    return create_model(repository, payload)


@router.get("/{model_id}", response_model=ModelOut)
def get_model_by_id(model_id: str, repository: FinancialRepository = Depends(get_repository)) -> ModelOut:
    return get_model(repository, model_id)


@router.patch("/{model_id}/timeline", response_model=ModelOut)
def patch_model_timeline(
    model_id: str,
    payload: UpdateTimelineRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> ModelOut:
    return update_model_timeline(repository, model_id, payload)


@router.get("/{model_id}/board", response_model=BoardResponse)
def get_model_board(
    model_id: str,
    scenario_id: str | None = Query(default=None),
    repository: FinancialRepository = Depends(get_repository),
) -> BoardResponse:
    return build_board(repository, model_id, scenario_id)


@router.post("/{model_id}/premises", response_model=PremiseOut, status_code=201)
def post_model_premise(
    model_id: str,
    payload: CreateModelPremiseRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> PremiseOut:
    return create_model_premise(repository, model_id, payload)


@router.post("/{model_id}/premises/from-output", response_model=PremiseOut, status_code=201)
def post_model_premise_from_output(
    model_id: str,
    payload: CreatePremiseFromOutputRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> PremiseOut:
    return create_premise_from_output(repository, model_id, payload)


@router.get("/{model_id}/scenarios", response_model=list[ScenarioOut])
def get_model_scenarios(
    model_id: str,
    repository: FinancialRepository = Depends(get_repository),
) -> list[ScenarioOut]:
    return list_scenarios(repository, model_id)


@router.post("/{model_id}/scenarios", response_model=ScenarioOut, status_code=201)
def post_model_scenario(
    model_id: str,
    payload: CreateScenarioRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> ScenarioOut:
    return create_scenario(repository, model_id, payload)


@router.post("/{model_id}/import-grid", response_model=ImportGridResponse)
def post_import_grid(
    model_id: str,
    payload: ImportGridRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> ImportGridResponse:
    return import_grid(repository, model_id, payload.raw_text)


@router.get("/{model_id}/dependencies", response_model=DependenciesResponse)
def get_dependencies(
    model_id: str,
    repository: FinancialRepository = Depends(get_repository),
) -> DependenciesResponse:
    return get_model_dependencies(repository, model_id)


@router.get("/{model_id}/dependencies/tree", response_model=DependencyTreeResponse)
def get_dependencies_tree(
    model_id: str,
    root_premise_id: str,
    repository: FinancialRepository = Depends(get_repository),
) -> DependencyTreeResponse:
    return get_model_dependencies_tree(repository, model_id, root_premise_id)


@router.delete("/{model_id}/premises/{premise_id}", status_code=204)
def delete_model_premise(
    model_id: str,
    premise_id: str,
    repository: FinancialRepository = Depends(get_repository),
) -> None:
    delete_premise(repository, model_id, premise_id)


@router.get("/{model_id}/outputs", response_model=list[ModelOutputOut])
def get_outputs(
    model_id: str,
    repository: FinancialRepository = Depends(get_repository),
) -> list[ModelOutputOut]:
    return list_model_outputs(repository, model_id)


@router.post("/{model_id}/outputs", response_model=ModelOutputOut, status_code=201)
def post_output(
    model_id: str,
    payload: CreateOutputRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> ModelOutputOut:
    return create_output(repository, model_id, payload)


@router.patch("/{model_id}/outputs/{output_id}", response_model=ModelOutputOut)
def patch_output(
    model_id: str,
    output_id: str,
    payload: UpdateOutputRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> ModelOutputOut:
    return update_output(repository, model_id, output_id, payload)
