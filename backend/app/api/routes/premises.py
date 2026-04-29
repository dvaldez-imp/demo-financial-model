from fastapi import APIRouter, Depends

from app.api.deps import get_repository
from app.repositories.base import FinancialRepository
from app.schemas.api import PremiseOut, UpdatePredictionConfigRequest, UpdatePremiseRequest
from app.schemas.api import UpdateVariableNameRequest, UpdateYearSummaryConfigRequest
from app.services.models import (
    update_model_premise_variable_name,
    update_prediction_config,
    update_premise,
    update_year_summary_config,
)

router = APIRouter(tags=["premises"])


@router.patch("/premises/{premise_id}", response_model=PremiseOut)
def patch_premise(
    premise_id: str,
    payload: UpdatePremiseRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> PremiseOut:
    return update_premise(repository, premise_id, payload)


@router.patch("/premises/{premise_id}/prediction-config", response_model=PremiseOut)
def patch_prediction_config(
    premise_id: str,
    payload: UpdatePredictionConfigRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> PremiseOut:
    return update_prediction_config(repository, premise_id, payload)


@router.patch("/premises/{premise_id}/year-summary-config", response_model=PremiseOut)
def patch_year_summary_config(
    premise_id: str,
    payload: UpdateYearSummaryConfigRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> PremiseOut:
    return update_year_summary_config(repository, premise_id, payload)


@router.patch("/premises/{premise_id}/variable-name", response_model=PremiseOut)
def patch_variable_name(
    premise_id: str,
    payload: UpdateVariableNameRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> PremiseOut:
    return update_model_premise_variable_name(repository, premise_id, payload)
