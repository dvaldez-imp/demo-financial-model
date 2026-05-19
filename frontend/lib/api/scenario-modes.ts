import { apiFetch } from "@/lib/api/client";
import type { SetScenarioPremiseModeRequest } from "@/lib/types/api";

export function getScenarioPremiseModes(scenarioId: string) {
  return apiFetch<Record<string, string>>(`/scenarios/${scenarioId}/premise-modes`);
}

export function setScenarioPremiseMode(
  scenarioId: string,
  premiseId: string,
  payload: SetScenarioPremiseModeRequest,
) {
  return apiFetch<void>(`/scenarios/${scenarioId}/premise-modes/${premiseId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function removeScenarioPremiseMode(scenarioId: string, premiseId: string) {
  return apiFetch<void>(`/scenarios/${scenarioId}/premise-modes/${premiseId}`, { method: "DELETE" });
}
