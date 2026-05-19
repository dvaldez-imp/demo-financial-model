from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_repository
from app.repositories.base import FinancialRepository
from app.schemas.api import (
    CompositePremiseModeOut,
    CompositePremiseModeOverrideOut,
    CreateCompositePremiseModeRequest,
    CreatePremiseModeRequest,
    PremiseModeOut,
    UpdateCompositePremiseModeRequest,
    UpdatePremiseModeRequest,
)
from app.schemas.domain import CompositePremiseModeRecord, PremiseModeRecord
from app.services.ids import generate_id
from app.services.models import _prediction_out

router = APIRouter(tags=["premise-modes"])


def _mode_out(mode: PremiseModeRecord) -> PremiseModeOut:
    return PremiseModeOut(
        id=mode.id,
        premise_id=mode.premise_id,
        name=mode.name,
        is_default=mode.is_default,
        prediction_config=_prediction_out(mode.prediction_config),
    )


def _composite_out(mode: CompositePremiseModeRecord) -> CompositePremiseModeOut:
    return CompositePremiseModeOut(
        id=mode.id,
        premise_id=mode.premise_id,
        name=mode.name,
        is_default=mode.is_default,
        overrides=[CompositePremiseModeOverrideOut(premise_id=o["premise_id"], mode_id=o["mode_id"]) for o in mode.overrides],
        inherited_from_mode_id=mode.inherited_from_mode_id,
    )


# ── Primitive premise modes ───────────────────────────────────────────────────

@router.get("/premises/{premise_id}/modes", response_model=list[PremiseModeOut])
def list_premise_modes(
    premise_id: str,
    repository: FinancialRepository = Depends(get_repository),
) -> list[PremiseModeOut]:
    if repository.get_model_premise(premise_id) is None:
        raise HTTPException(status_code=404, detail="Premise not found.")
    return [_mode_out(m) for m in repository.list_premise_modes(premise_id)]


@router.post("/premises/{premise_id}/modes", response_model=PremiseModeOut, status_code=201)
def create_premise_mode(
    premise_id: str,
    payload: CreatePremiseModeRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> PremiseModeOut:
    premise = repository.get_model_premise(premise_id)
    if premise is None:
        raise HTTPException(status_code=404, detail="Premise not found.")
    if premise.dependency_type != "none":
        raise HTTPException(status_code=400, detail="Primitive modes only apply to premises with dependency_type='none'.")
    existing = repository.list_premise_modes(premise_id)
    if any(m.name.lower() == payload.name.strip().lower() for m in existing):
        raise HTTPException(status_code=400, detail="A mode with that name already exists for this premise.")
    mode = PremiseModeRecord(
        id=generate_id("mode"),
        premise_id=premise_id,
        name=payload.name.strip(),
        is_default=len(existing) == 0,
        prediction_config=payload.prediction_config,
    )
    return _mode_out(repository.create_premise_mode(mode=mode))


@router.patch("/premises/{premise_id}/modes/{mode_id}", response_model=PremiseModeOut)
def update_premise_mode(
    premise_id: str,
    mode_id: str,
    payload: UpdatePremiseModeRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> PremiseModeOut:
    mode = repository.get_premise_mode(mode_id)
    if mode is None or mode.premise_id != premise_id:
        raise HTTPException(status_code=404, detail="Mode not found.")
    changes: dict[str, object] = {}
    if payload.name is not None:
        existing = repository.list_premise_modes(premise_id)
        if any(m.name.lower() == payload.name.strip().lower() and m.id != mode_id for m in existing):
            raise HTTPException(status_code=400, detail="A mode with that name already exists.")
        changes["name"] = payload.name.strip()
    if payload.prediction_config is not None:
        changes["prediction_config"] = payload.prediction_config
    updated = repository.update_premise_mode(mode_id=mode_id, changes=changes)
    assert updated is not None
    return _mode_out(updated)


@router.delete("/premises/{premise_id}/modes/{mode_id}", status_code=204)
def delete_premise_mode(
    premise_id: str,
    mode_id: str,
    repository: FinancialRepository = Depends(get_repository),
) -> None:
    mode = repository.get_premise_mode(mode_id)
    if mode is None or mode.premise_id != premise_id:
        raise HTTPException(status_code=404, detail="Mode not found.")
    if mode.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default mode. Set another mode as default first.")
    repository.delete_premise_mode(mode_id=mode_id)


@router.post("/premises/{premise_id}/modes/{mode_id}/set-default", response_model=PremiseModeOut)
def set_default_premise_mode(
    premise_id: str,
    mode_id: str,
    repository: FinancialRepository = Depends(get_repository),
) -> PremiseModeOut:
    mode = repository.get_premise_mode(mode_id)
    if mode is None or mode.premise_id != premise_id:
        raise HTTPException(status_code=404, detail="Mode not found.")
    repository.set_default_premise_mode(premise_id=premise_id, mode_id=mode_id)
    updated = repository.get_premise_mode(mode_id)
    assert updated is not None
    return _mode_out(updated)


# ── Composite premise modes ───────────────────────────────────────────────────

@router.get("/premises/{premise_id}/composite-modes", response_model=list[CompositePremiseModeOut])
def list_composite_premise_modes(
    premise_id: str,
    repository: FinancialRepository = Depends(get_repository),
) -> list[CompositePremiseModeOut]:
    if repository.get_model_premise(premise_id) is None:
        raise HTTPException(status_code=404, detail="Premise not found.")
    return [_composite_out(m) for m in repository.list_composite_premise_modes(premise_id)]


@router.post("/premises/{premise_id}/composite-modes", response_model=CompositePremiseModeOut, status_code=201)
def create_composite_premise_mode(
    premise_id: str,
    payload: CreateCompositePremiseModeRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> CompositePremiseModeOut:
    premise = repository.get_model_premise(premise_id)
    if premise is None:
        raise HTTPException(status_code=404, detail="Premise not found.")
    if premise.dependency_type == "none":
        raise HTTPException(status_code=400, detail="Composite modes only apply to dependent premises.")
    existing = repository.list_composite_premise_modes(premise_id)
    if any(m.name.lower() == payload.name.strip().lower() for m in existing):
        raise HTTPException(status_code=400, detail="A composite mode with that name already exists.")
    mode = CompositePremiseModeRecord(
        id=generate_id("cmode"),
        premise_id=premise_id,
        name=payload.name.strip(),
        is_default=len(existing) == 0,
        overrides=[{"premise_id": o.premise_id, "mode_id": o.mode_id} for o in payload.overrides],
        inherited_from_mode_id=payload.inherited_from_mode_id,
    )
    return _composite_out(repository.create_composite_premise_mode(mode=mode))


@router.patch("/premises/{premise_id}/composite-modes/{mode_id}", response_model=CompositePremiseModeOut)
def update_composite_premise_mode(
    premise_id: str,
    mode_id: str,
    payload: UpdateCompositePremiseModeRequest,
    repository: FinancialRepository = Depends(get_repository),
) -> CompositePremiseModeOut:
    mode = repository.get_composite_premise_mode(mode_id)
    if mode is None or mode.premise_id != premise_id:
        raise HTTPException(status_code=404, detail="Composite mode not found.")
    changes: dict[str, object] = {}
    if payload.name is not None:
        existing = repository.list_composite_premise_modes(premise_id)
        if any(m.name.lower() == payload.name.strip().lower() and m.id != mode_id for m in existing):
            raise HTTPException(status_code=400, detail="A composite mode with that name already exists.")
        changes["name"] = payload.name.strip()
    if payload.overrides is not None:
        changes["overrides"] = [{"premise_id": o.premise_id, "mode_id": o.mode_id} for o in payload.overrides]
    updated = repository.update_composite_premise_mode(mode_id=mode_id, changes=changes)
    assert updated is not None
    return _composite_out(updated)


@router.delete("/premises/{premise_id}/composite-modes/{mode_id}", status_code=204)
def delete_composite_premise_mode(
    premise_id: str,
    mode_id: str,
    repository: FinancialRepository = Depends(get_repository),
) -> None:
    mode = repository.get_composite_premise_mode(mode_id)
    if mode is None or mode.premise_id != premise_id:
        raise HTTPException(status_code=404, detail="Composite mode not found.")
    if mode.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default mode. Set another mode as default first.")
    repository.delete_composite_premise_mode(mode_id=mode_id)


@router.post("/premises/{premise_id}/composite-modes/{mode_id}/set-default", response_model=CompositePremiseModeOut)
def set_default_composite_premise_mode(
    premise_id: str,
    mode_id: str,
    repository: FinancialRepository = Depends(get_repository),
) -> CompositePremiseModeOut:
    mode = repository.get_composite_premise_mode(mode_id)
    if mode is None or mode.premise_id != premise_id:
        raise HTTPException(status_code=404, detail="Composite mode not found.")
    repository.set_default_composite_premise_mode(premise_id=premise_id, mode_id=mode_id)
    updated = repository.get_composite_premise_mode(mode_id)
    assert updated is not None
    return _composite_out(updated)
