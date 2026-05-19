from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_repository
from app.repositories.base import FinancialRepository
from app.schemas.api import SetScenarioPremiseModeRequest

router = APIRouter(tags=["scenario-modes"])


@router.get("/scenarios/{scenario_id}/premise-modes")
def get_scenario_premise_modes(
    scenario_id: str,
    repository: FinancialRepository = Depends(get_repository),
) -> dict[str, str]:
    """Returns {premise_id: mode_id} for all explicit mode selections in the scenario."""
    if repository.get_scenario(scenario_id) is None:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    return repository.get_scenario_premise_modes(scenario_id)


@router.put("/scenarios/{scenario_id}/premise-modes/{premise_id}", status_code=204)
def set_scenario_premise_mode(
    scenario_id: str,
    premise_id: str,
    payload: SetScenarioPremiseModeRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> None:
    """Set or update the mode a scenario uses for a premise."""
    scenario = repository.get_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    if scenario.is_base:
        raise HTTPException(status_code=400, detail="Cannot set mode overrides on the base scenario.")
    premise = repository.get_model_premise(premise_id)
    if premise is None or premise.model_id != scenario.model_id:
        raise HTTPException(status_code=400, detail="Premise not found or does not belong to the scenario's model.")
    # Validate mode exists and belongs to this premise
    if premise.dependency_type == "none":
        mode = repository.get_premise_mode(payload.mode_id)
        if mode is None or mode.premise_id != premise_id:
            raise HTTPException(status_code=400, detail="Mode not found for this premise.")
    else:
        mode_comp = repository.get_composite_premise_mode(payload.mode_id)
        if mode_comp is None or mode_comp.premise_id != premise_id:
            raise HTTPException(status_code=400, detail="Composite mode not found for this premise.")
    repository.upsert_scenario_premise_mode(scenario_id=scenario_id, premise_id=premise_id, mode_id=payload.mode_id)


@router.delete("/scenarios/{scenario_id}/premise-modes/{premise_id}", status_code=204)
def remove_scenario_premise_mode(
    scenario_id: str,
    premise_id: str,
    repository: FinancialRepository = Depends(get_repository),
) -> None:
    """Reset a premise to its default mode in this scenario."""
    if repository.get_scenario(scenario_id) is None:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    repository.remove_scenario_premise_mode(scenario_id=scenario_id, premise_id=premise_id)
