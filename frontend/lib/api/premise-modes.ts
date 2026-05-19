import { apiFetch } from "@/lib/api/client";
import type {
  CompositePremiseMode,
  CreateCompositePremiseModeRequest,
  CreatePremiseModeRequest,
  PremiseMode,
  UpdateCompositePremiseModeRequest,
  UpdatePremiseModeRequest,
} from "@/lib/types/api";

export function listPremiseModes(premiseId: string) {
  return apiFetch<PremiseMode[]>(`/premises/${premiseId}/modes`);
}

export function createPremiseMode(premiseId: string, payload: CreatePremiseModeRequest) {
  return apiFetch<PremiseMode>(`/premises/${premiseId}/modes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePremiseMode(premiseId: string, modeId: string, payload: UpdatePremiseModeRequest) {
  return apiFetch<PremiseMode>(`/premises/${premiseId}/modes/${modeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deletePremiseMode(premiseId: string, modeId: string) {
  return apiFetch<void>(`/premises/${premiseId}/modes/${modeId}`, { method: "DELETE" });
}

export function setDefaultPremiseMode(premiseId: string, modeId: string) {
  return apiFetch<PremiseMode>(`/premises/${premiseId}/modes/${modeId}/set-default`, { method: "POST" });
}

export function listCompositePremiseModes(premiseId: string) {
  return apiFetch<CompositePremiseMode[]>(`/premises/${premiseId}/composite-modes`);
}

export function createCompositePremiseMode(premiseId: string, payload: CreateCompositePremiseModeRequest) {
  return apiFetch<CompositePremiseMode>(`/premises/${premiseId}/composite-modes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCompositePremiseMode(premiseId: string, modeId: string, payload: UpdateCompositePremiseModeRequest) {
  return apiFetch<CompositePremiseMode>(`/premises/${premiseId}/composite-modes/${modeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteCompositePremiseMode(premiseId: string, modeId: string) {
  return apiFetch<void>(`/premises/${premiseId}/composite-modes/${modeId}`, { method: "DELETE" });
}

export function setDefaultCompositePremiseMode(premiseId: string, modeId: string) {
  return apiFetch<CompositePremiseMode>(`/premises/${premiseId}/composite-modes/${modeId}/set-default`, {
    method: "POST",
  });
}
