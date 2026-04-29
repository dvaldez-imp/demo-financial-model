from fastapi import APIRouter, Depends

from app.api.deps import get_repository
from app.repositories.base import FinancialRepository
from app.schemas.api import ScenarioOut, UpdateScenarioRequest
from app.services.models import update_scenario

router = APIRouter(tags=["scenarios"])


@router.patch("/scenarios/{scenario_id}", response_model=ScenarioOut)
def patch_scenario(
    scenario_id: str,
    payload: UpdateScenarioRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> ScenarioOut:
    return update_scenario(repository, scenario_id, payload)
