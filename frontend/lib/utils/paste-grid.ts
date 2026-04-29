import { detectPreviewPeriod, type DetectedPreviewPeriod } from "@/lib/utils/periods";

export type ParsedPastePreviewRow = {
  premiseName: string;
  values: string[];
};

export type ParsedPastePreview = {
  headers: string[];
  periods: DetectedPreviewPeriod[];
  rows: ParsedPastePreviewRow[];
};

function splitLines(rawText: string) {
  return rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

export function parsePastedGrid(
  rawText: string,
  actualsEndPeriodKey?: string | null,
  forecastEndPeriodKey?: string | null,
): ParsedPastePreview | null {
  const lines = splitLines(rawText);

  if (lines.length < 2) {
    return null;
  }

  const [headerLine, ...dataLines] = lines;
  const headers = headerLine.split("\t").map((cell) => cell.trim());

  if (headers.length < 2) {
    return null;
  }

  const periods = headers
    .slice(1)
    .map((header) =>
      detectPreviewPeriod(header, actualsEndPeriodKey, forecastEndPeriodKey),
    );
  const rows = dataLines
    .map((line) => line.split("\t").map((cell) => cell.trim()))
    .filter((cells) => cells.some((cell) => cell.length > 0))
    .map((cells) => ({
      premiseName: cells[0] ?? "",
      values: periods.map((_, index) => cells[index + 1] ?? ""),
    }))
    .filter((row) => row.premiseName.length > 0);

  if (rows.length === 0) {
    return null;
  }

  return {
    headers,
    periods,
    rows,
  };
}
