import { apiFetch } from "@/lib/api/client";
import type { ActivityLogEntryOut, CreateActivityLogRequest } from "@/lib/types/api";

export function getActivityLog() {
  return apiFetch<ActivityLogEntryOut[]>("/activity-log");
}

export function createActivityLogEntry(payload: CreateActivityLogRequest) {
  return apiFetch<ActivityLogEntryOut>("/activity-log", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
