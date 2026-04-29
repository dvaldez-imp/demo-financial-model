from fastapi import APIRouter, Depends

from app.api.deps import get_repository
from app.repositories.base import FinancialRepository
from app.schemas.api import CatalogModelOutputOut
from app.services.outputs import list_output_catalog

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/model-outputs", response_model=list[CatalogModelOutputOut])
def get_model_output_catalog(
    repository: FinancialRepository = Depends(get_repository),
) -> list[CatalogModelOutputOut]:
    return list_output_catalog(repository)
