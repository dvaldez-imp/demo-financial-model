"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { BoardPremise } from "@/lib/types/api";
import {
  buildMappedImportText,
  type PasteRowMapping,
} from "@/lib/utils/board-import";
import { parsePastedGrid } from "@/lib/utils/paste-grid";
import { getPeriodZoneLabel } from "@/lib/utils/periods";

type PasteExcelModalProps = {
  open: boolean;
  pending?: boolean;
  actualsEndPeriodKey: string | null;
  forecastEndPeriodKey: string | null;
  premises: BoardPremise[];
  onClose: () => void;
  onConfirm: (rawText: string) => Promise<void> | void;
};

const EXAMPLE_TEXT =
  "Premisa\tene-25\tfeb-25\t2025\nGasolina\t34\t35\t420\nInflacion\t3\t3.2\t3.5";

export default function PasteExcelModal({
  actualsEndPeriodKey,
  forecastEndPeriodKey,
  onClose,
  onConfirm,
  open,
  pending = false,
  premises,
}: PasteExcelModalProps) {
  const [rawText, setRawText] = useState("");
  const [rowMappings, setRowMappings] = useState<Record<number, PasteRowMapping>>({});

  const preview = useMemo(
    () => parsePastedGrid(rawText, actualsEndPeriodKey, forecastEndPeriodKey),
    [actualsEndPeriodKey, forecastEndPeriodKey, rawText],
  );

  async function handleConfirm() {
    const mappedText = buildMappedImportText(
      rawText,
      preview,
      Object.values(rowMappings),
    );
    await onConfirm(mappedText);
    setRawText("");
    setRowMappings({});
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pegar desde Excel"
      description="Pega una tabla TSV copiada desde Excel y decide si cada fila se asocia a una premisa existente o crea una nueva."
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-[var(--foreground)]">Tabla pegada</span>
          <textarea
            className="min-h-44 rounded-[24px] border border-[var(--border)] bg-white p-4 text-sm outline-none transition placeholder:text-[var(--foreground-muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            placeholder={EXAMPLE_TEXT}
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
          />
        </label>

        <div className="rounded-[24px] border border-[var(--border)] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Preview de importacion
              </h3>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                Las columnas se clasifican segun el timeline actual del modelo.
              </p>
            </div>
            {preview ? <Badge tone="success">{preview.rows.length} filas</Badge> : null}
          </div>

          {preview ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {preview.periods.map((period, index) => (
                  <Badge
                    key={`${period.rawLabel}-${index}`}
                    tone={
                      period.zone === "summary"
                        ? "warning"
                        : period.zone === "forecast"
                          ? "accent"
                          : "neutral"
                    }
                  >
                    {period.normalizedLabel} ·{" "}
                    {period.zone === "unknown"
                      ? "Sin clasificar"
                      : getPeriodZoneLabel(period.zone)}
                  </Badge>
                ))}
              </div>

              <div className="grid-scrollbar overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-[var(--foreground-muted)]">
                      <th className="px-3 py-1 font-medium">Fila</th>
                      <th className="px-3 py-1 font-medium">Destino</th>
                      {preview.headers.map((header) => (
                        <th key={header} className="px-3 py-1 font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, index) => {
                      const mapping = rowMappings[index];

                      return (
                        <tr key={`${row.premiseName}-${index}`}>
                          <td className="rounded-l-2xl bg-[var(--surface-muted)] px-3 py-2 font-medium text-[var(--foreground)]">
                            {index + 1}
                          </td>
                          <td className="bg-[var(--surface-muted)] px-3 py-2">
                            <div className="flex min-w-[240px] flex-col gap-2">
                              <select
                                className="h-10 rounded-2xl border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                                value={mapping?.mode || "new"}
                                onChange={(event) =>
                                  setRowMappings((current) => ({
                                    ...current,
                                    [index]: {
                                      rowIndex: index,
                                      mode: event.target.value as "existing" | "new",
                                      premiseName:
                                        current[index]?.premiseName || row.premiseName,
                                    },
                                  }))
                                }
                              >
                                <option value="new">Crear nueva</option>
                                <option value="existing">Asociar a premisa existente</option>
                              </select>

                              {(mapping?.mode || "new") === "existing" ? (
                                <select
                                  className="h-10 rounded-2xl border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                                  value={mapping?.premiseName || ""}
                                  onChange={(event) =>
                                    setRowMappings((current) => ({
                                      ...current,
                                      [index]: {
                                        rowIndex: index,
                                        mode: "existing",
                                        premiseName: event.target.value,
                                      },
                                    }))
                                  }
                                >
                                  <option value="">Selecciona premisa</option>
                                  {premises.map((premise) => (
                                    <option key={premise.id} value={premise.name}>
                                      {premise.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  className="h-10 rounded-2xl border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                                  value={mapping?.premiseName || row.premiseName}
                                  onChange={(event) =>
                                    setRowMappings((current) => ({
                                      ...current,
                                      [index]: {
                                        rowIndex: index,
                                        mode: "new",
                                        premiseName: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              )}
                            </div>
                          </td>
                          <td className="bg-[var(--surface-muted)] px-3 py-2 font-medium text-[var(--foreground)]">
                            {row.premiseName}
                          </td>
                          {row.values.map((value, valueIndex) => (
                            <td
                              key={`${row.premiseName}-${valueIndex}`}
                              className="numeric-cell bg-[var(--surface-muted)] px-3 py-2 text-[var(--foreground-muted)]"
                            >
                              {value || "-"}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--foreground-muted)]">
              Pega al menos una cabecera y una fila de datos para ver el preview.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={pending || !preview || rawText.trim().length === 0}
          >
            Importar grid
          </Button>
        </div>
      </div>
    </Modal>
  );
}
