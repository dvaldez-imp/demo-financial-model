from __future__ import annotations

from app.repositories.base import FinancialRepository
from app.schemas.api import ResetDataResponse


def reset_data(repository: FinancialRepository, *, seed_demo: bool = True) -> ResetDataResponse:
    repository.reset_data(seed_demo=seed_demo)
    return ResetDataResponse(
        status="ok",
        seed_demo=seed_demo,
        models_count=len(repository.list_models()),
    )
