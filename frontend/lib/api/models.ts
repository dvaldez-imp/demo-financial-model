import { apiFetch } from "@/lib/api/client";
import type {
  BoardResponse,
  CatalogModelOutputOut,
  CreateModelPremiseRequest,
  CreateOutputRequest,
  CreatePremiseFromOutputRequest,
  CreateScenarioRequest,
  DeleteResponse,
  DependencyTreeResponse,
  DependenciesResponse,
  ImportGridResponse,
  ModelOut,
  ModelOutputOut,
  PremiseOut,
  ResetDataResponse,
  ScenarioOut,
  UpdateOutputRequest,
  UpdateTimelineRequest,
} from "@/lib/types/api";

export function getModels() {
  return apiFetch<ModelOut[]>("/models");
}

export function getModelBoard(modelId: string, scenarioId?: string) {
  const query = scenarioId
    ? `?scenario_id=${encodeURIComponent(scenarioId)}`
    : "";
  return apiFetch<BoardResponse>(`/models/${modelId}/board${query}`);
}

export function updateModelTimeline(
  modelId: string,
  payload: UpdateTimelineRequest,
) {
  return apiFetch<ModelOut>(`/models/${modelId}/timeline`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function createModelPremise(
  modelId: string,
  payload: CreateModelPremiseRequest,
) {
  return apiFetch<PremiseOut>(`/models/${modelId}/premises`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteModelPremise(modelId: string, premiseId: string) {
  return apiFetch<DeleteResponse>(`/models/${modelId}/premises/${premiseId}`, {
    method: "DELETE",
  });
}

export function createPremiseFromOutput(
  modelId: string,
  payload: CreatePremiseFromOutputRequest,
) {
  return apiFetch<PremiseOut>(`/models/${modelId}/premises/from-output`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getModelScenarios(modelId: string) {
  return apiFetch<ScenarioOut[]>(`/models/${modelId}/scenarios`);
}

export function createModelScenario(
  modelId: string,
  payload: CreateScenarioRequest,
) {
  return apiFetch<ScenarioOut>(`/models/${modelId}/scenarios`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function importModelGrid(modelId: string, rawText: string) {
  return apiFetch<ImportGridResponse>(`/models/${modelId}/import-grid`, {
    method: "POST",
    body: JSON.stringify({ raw_text: rawText }),
  });
}

export function getModelDependencies(modelId: string) {
  return apiFetch<DependenciesResponse>(`/models/${modelId}/dependencies`);
}

export function getModelDependenciesTree(
  modelId: string,
  rootPremiseId: string,
) {
  const query = `?root_premise_id=${encodeURIComponent(rootPremiseId)}`;
  return apiFetch<DependencyTreeResponse>(
    `/models/${modelId}/dependencies/tree${query}`,
  );
}

export function getModelOutputs(modelId: string) {
  return apiFetch<ModelOutputOut[]>(`/models/${modelId}/outputs`);
}

export function createModelOutput(
  modelId: string,
  payload: CreateOutputRequest,
) {
  return apiFetch<ModelOutputOut>(`/models/${modelId}/outputs`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateModelOutput(
  modelId: string,
  outputId: string,
  payload: UpdateOutputRequest,
) {
  return apiFetch<ModelOutputOut>(`/models/${modelId}/outputs/${outputId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getCatalogModelOutputs() {
  return apiFetch<CatalogModelOutputOut[]>("/catalog/model-outputs");
}

export function resetDemoData(seedDemo = true) {
  return apiFetch<ResetDataResponse>("/admin/reset-data", {
    method: "POST",
    body: JSON.stringify({ seed_demo: seedDemo }),
  });
}
