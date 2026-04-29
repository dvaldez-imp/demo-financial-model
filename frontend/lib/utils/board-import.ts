import type { BoardResponse, BoardValue } from "@/lib/types/api";
import type { ParsedPastePreview } from "@/lib/utils/paste-grid";

export type PasteRowMode = "existing" | "new";

export type PasteRowMapping = {
  rowIndex: number;
  mode: PasteRowMode;
  premiseName: string;
};

function formatCellValue(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "";
  }

  return `${value}`;
}

function shouldSerializeBoardValue(cell: BoardValue | undefined) {
  if (!cell) {
    return false;
  }

  return cell.editable || cell.value_origin === "actual" || cell.value_origin === "forecast_manual";
}

export function serializeBoardToImportText(board: BoardResponse) {
  const header = ["Premisa", ...board.periods.map((period) => period.label)].join(
    "\t",
  );

  const rows = board.premises.map((premise) => {
    const valuesByPeriod = new Map(
      premise.values.map((value) => [value.period_key, value]),
    );

    return [
      premise.name,
      ...board.periods.map((period) => {
        const cell = valuesByPeriod.get(period.key);
        return shouldSerializeBoardValue(cell)
          ? formatCellValue(cell?.value ?? null)
          : "";
      }),
    ].join("\t");
  });

  return [header, ...rows].join("\n");
}

export function buildMappedImportText(
  rawText: string,
  preview: ParsedPastePreview | null,
  mappings: PasteRowMapping[],
) {
  if (!preview) {
    return rawText;
  }

  const lines = rawText.replace(/\r\n/g, "\n").split("\n");

  if (lines.length <= 1) {
    return rawText;
  }

  const mappedRows = lines.slice(1).map((line, index) => {
    if (!line.trim()) {
      return line;
    }

    const cells = line.split("\t");
    const mapping = mappings.find((item) => item.rowIndex === index);

    if (mapping) {
      cells[0] = mapping.premiseName;
    }

    return cells.join("\t");
  });

  return [lines[0], ...mappedRows].join("\n");
}
