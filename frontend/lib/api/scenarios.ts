import { apiFetch } from "@/lib/api/client";
import type {
  PremiseOut,
  ScenarioOut,
  UpdatePredictionConfigRequest,
  UpdatePremiseRequest,
  UpdateYearSummaryConfigRequest,
  UpdateScenarioRequest,
  UpdateVariableNameRequest,
} from "@/lib/types/api";

export function updatePremise(
  premiseId: string,
  payload: UpdatePremiseRequest,
) {
  return apiFetch<PremiseOut>(`/premises/${premiseId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updatePremisePredictionConfig(
  premiseId: string,
  payload: UpdatePredictionConfigRequest,
) {
  return apiFetch<PremiseOut>(`/premises/${premiseId}/prediction-config`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updatePremiseYearSummaryConfig(
  premiseId: string,
  payload: UpdateYearSummaryConfigRequest,
) {
  return apiFetch<PremiseOut>(`/premises/${premiseId}/year-summary-config`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateScenario(
  scenarioId: string,
  payload: UpdateScenarioRequest,
) {
  return apiFetch<ScenarioOut>(`/scenarios/${scenarioId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updatePremiseVariableName(
  premiseId: string,
  payload: UpdateVariableNameRequest,
) {
  return apiFetch<PremiseOut>(`/premises/${premiseId}/variable-name`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

