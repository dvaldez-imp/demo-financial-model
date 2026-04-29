import { apiFetch } from "@/lib/api/client";
import type {
  CreateLibraryPremiseRequest,
  DeleteResponse,
  LibraryPremise,
  PremiseOut,
  UpdateVariableNameRequest,
} from "@/lib/types/api";

export function getLibraryPremises() {
  return apiFetch<LibraryPremise[]>("/library/premises");
}

export function createLibraryPremise(payload: CreateLibraryPremiseRequest) {
  return apiFetch<PremiseOut>("/library/premises", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteLibraryPremise(premiseId: string) {
  return apiFetch<DeleteResponse>(`/library/premises/${premiseId}`, {
    method: "DELETE",
  });
}

export function updateLibraryPremiseVariableName(
  premiseId: string,
  payload: UpdateVariableNameRequest,
) {
  return apiFetch<PremiseOut>(`/library/premises/${premiseId}/variable-name`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
