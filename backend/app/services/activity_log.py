from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.repositories.base import FinancialRepository
from app.schemas.api import ActivityLogEntryOut, CreateActivityLogRequest
from app.schemas.domain import ActivityLogRecord


def list_activity_log(repository: FinancialRepository) -> list[ActivityLogEntryOut]:
    return [_to_out(e) for e in repository.list_activity_log()]


def create_activity_log_entry(
    repository: FinancialRepository,
    payload: CreateActivityLogRequest,
) -> ActivityLogEntryOut:
    entry = ActivityLogRecord(
        id=str(uuid.uuid4()),
        timestamp=datetime.now(timezone.utc).isoformat(),
        user=payload.user,
        user_initials=payload.user_initials,
        user_color=payload.user_color,
        action_type=payload.action_type,
        target_type=payload.target_type,
        target_name=payload.target_name,
        model_name=payload.model_name,
        description=payload.description,
        detail=payload.detail,
    )
    return _to_out(repository.create_activity_log_entry(entry=entry))


def _to_out(entry: ActivityLogRecord) -> ActivityLogEntryOut:
    return ActivityLogEntryOut(
        id=entry.id,
        timestamp=entry.timestamp,
        user=entry.user,
        user_initials=entry.user_initials,
        user_color=entry.user_color,
        action_type=entry.action_type,
        target_type=entry.target_type,
        target_name=entry.target_name,
        model_name=entry.model_name,
        description=entry.description,
        detail=entry.detail,
    )
