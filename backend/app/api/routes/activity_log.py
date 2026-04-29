from fastapi import APIRouter, Depends

from app.api.deps import get_repository
from app.repositories.base import FinancialRepository
from app.schemas.api import ActivityLogEntryOut, CreateActivityLogRequest
from app.services.activity_log import create_activity_log_entry, list_activity_log

router = APIRouter(prefix="/activity-log", tags=["activity-log"])


@router.get("", response_model=list[ActivityLogEntryOut])
def get_activity_log(
    repository: FinancialRepository = Depends(get_repository),
) -> list[ActivityLogEntryOut]:
    return list_activity_log(repository)


@router.post("", response_model=ActivityLogEntryOut, status_code=201)
def post_activity_log_entry(
    payload: CreateActivityLogRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> ActivityLogEntryOut:
    return create_activity_log_entry(repository, payload)
