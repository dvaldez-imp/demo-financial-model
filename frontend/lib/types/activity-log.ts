export type ActionType =
  | "crear"
  | "editar"
  | "eliminar"
  | "importar"
  | "guardar"
  | "prediccion"
  | "escenario";

export type TargetType =
  | "premisa"
  | "modelo"
  | "escenario"
  | "celda"
  | "timeline"
  | "prediccion"
  | "grid";

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  user: string;
  userInitials: string;
  userColor: string;
  actionType: ActionType;
  targetType: TargetType;
  targetName: string;
  modelName: string;
  description: string;
  detail?: string;
}

export const ACTION_LABELS: Record<ActionType, string> = {
  crear: "Crear",
  editar: "Editar",
  eliminar: "Eliminar",
  importar: "Importar",
  guardar: "Guardar",
  prediccion: "Prediccion",
  escenario: "Escenario",
};

export const TARGET_LABELS: Record<TargetType, string> = {
  premisa: "Premisa",
  modelo: "Modelo",
  escenario: "Escenario",
  celda: "Celda",
  timeline: "Timeline",
  prediccion: "Prediccion",
  grid: "Grid",
};

export const ACTION_COLORS: Record<ActionType, string> = {
  crear: "var(--success)",
  editar: "var(--info)",
  eliminar: "var(--danger)",
  importar: "var(--accent-secondary)",
  guardar: "var(--accent)",
  prediccion: "#7c3aed",
  escenario: "#0891b2",
};

export const ACTION_BG: Record<ActionType, string> = {
  crear: "rgba(5,165,60,0.10)",
  editar: "rgba(55,129,206,0.10)",
  eliminar: "rgba(183,20,20,0.10)",
  importar: "rgba(252,76,2,0.10)",
  guardar: "rgba(0,56,101,0.10)",
  prediccion: "rgba(124,58,237,0.10)",
  escenario: "rgba(8,145,178,0.10)",
};
