from fastapi import APIRouter, Body, Depends

from app.api.deps import get_repository
from app.repositories.base import FinancialRepository
from app.schemas.api import ResetDataRequest, ResetDataResponse
from app.services.admin import reset_data

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/reset-data", response_model=ResetDataResponse)
def post_reset_data(
    payload: ResetDataRequest | None = Body(default=None),
    repository: FinancialRepository = Depends(get_repository),
) -> ResetDataResponse:
    seed_demo = payload.seed_demo if payload is not None else True
    return reset_data(repository, seed_demo=seed_demo)
