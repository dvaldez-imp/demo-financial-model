from fastapi import APIRouter, Depends

from app.api.deps import get_repository
from app.repositories.base import FinancialRepository
from app.schemas.api import CreateLibraryPremiseRequest, PremiseOut, UpdateVariableNameRequest
from app.services.models import create_library_premise, list_library_premises, update_library_premise_variable_name

router = APIRouter(prefix="/library", tags=["library"])


@router.get("/premises", response_model=list[PremiseOut])
def get_library_premises(
    repository: FinancialRepository = Depends(get_repository),
) -> list[PremiseOut]:
    return list_library_premises(repository)


@router.post("/premises", response_model=PremiseOut, status_code=201)
def post_library_premise(
    payload: CreateLibraryPremiseRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> PremiseOut:
    return create_library_premise(repository, payload)


@router.patch("/premises/{premise_id}/variable-name", response_model=PremiseOut)
def patch_library_variable_name(
    premise_id: str,
    payload: UpdateVariableNameRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> PremiseOut:
    return update_library_premise_variable_name(repository, premise_id, payload)
