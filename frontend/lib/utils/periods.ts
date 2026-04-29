import type {
  PeriodRecord,
  PeriodZone,
  PredictionConfig,
  PredictionMethod,
  PredictionConfigOut,
  YearGroupRecord,
} from "@/lib/types/api";

const SPANISH_MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

const MONTH_LOOKUP = new Map<string, number>([
  ["ene", 1],
  ["jan", 1],
  ["feb", 2],
  ["mar", 3],
  ["abr", 4],
  ["apr", 4],
  ["may", 5],
  ["jun", 6],
  ["jul", 7],
  ["ago", 8],
  ["aug", 8],
  ["sep", 9],
  ["sept", 9],
  ["oct", 10],
  ["nov", 11],
  ["dic", 12],
  ["dec", 12],
]);

const METHOD_LABELS: Record<PredictionMethod, string> = {
  manual: "Manual",
  carry_forward: "Repetir ultimo valor",
  growth_rate_pct: "Crecimiento %",
  formula_placeholder: "Formula simple",
  moving_average: "Promedio movil",
  linear_trend: "Tendencia lineal",
  seasonal_naive: "Estacional / oscilante",
  arima_like: "ARIMA simplificado",
};

const ZONE_LABELS: Record<PeriodZone, string> = {
  historical: "Historico",
  forecast: "Proyeccion",
  summary: "Resumen anual",
};

export type DetectedPreviewPeriod = {
  rawLabel: string;
  normalizedLabel: string;
  type: "month" | "year_summary" | "unknown";
  year: number | null;
  month: number | null;
  periodKey: string | null;
  zone: PeriodZone | "unknown";
};

export function comparePeriodKeys(left: string, right: string) {
  return left.localeCompare(right);
}

export function toCanonicalMonthLabel(year: number, month: number) {
  const shortYear = String(year).slice(-2);
  return `${SPANISH_MONTHS[month - 1]}-${shortYear}`;
}

export function toMonthPeriodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getPredictionMethodLabel(
  method: PredictionMethod,
  methodLabel?: string | null,
) {
  return methodLabel || METHOD_LABELS[method];
}

export function buildDefaultPredictionParams(
  method: PredictionMethod,
  currentParams: Record<string, unknown> = {},
) {
  if (method === "growth_rate_pct") {
    return { rate: Number(currentParams.rate ?? 0) };
  }

  if (method === "formula_placeholder") {
    return { expression: `${currentParams.expression ?? ""}` };
  }

  if (method === "moving_average") {
    return { window: Number(currentParams.window ?? 4) };
  }

  if (method === "linear_trend") {
    return { lookback_periods: Number(currentParams.lookback_periods ?? 12) };
  }

  if (method === "seasonal_naive") {
    return { season_length: Number(currentParams.season_length ?? 12) };
  }

  if (method === "arima_like") {
    return { lookback_periods: Number(currentParams.lookback_periods ?? 24) };
  }

  return {};
}

export function getPeriodZoneLabel(zone: PeriodZone) {
  return ZONE_LABELS[zone];
}

export function getPeriodVisualLabel(period: PeriodRecord) {
  if (period.type === "year_summary") {
    return {
      primary: String(period.year),
      secondary: "Resumen anual",
      zoneLabel: getPeriodZoneLabel(period.zone),
    };
  }

  if (!period.month) {
    return {
      primary: period.label,
      secondary: getPeriodZoneLabel(period.zone),
      zoneLabel: getPeriodZoneLabel(period.zone),
    };
  }

  const canonical = toCanonicalMonthLabel(period.year, period.month);

  return {
    primary: canonical,
    secondary:
      period.label !== canonical
        ? period.label
        : getPeriodZoneLabel(period.zone),
    zoneLabel: getPeriodZoneLabel(period.zone),
  };
}

export function detectPreviewPeriod(
  label: string,
  actualsEndPeriodKey?: string | null,
  forecastEndPeriodKey?: string | null,
): DetectedPreviewPeriod {
  const normalized = label.trim().toLowerCase();

  if (/^\d{4}$/.test(normalized)) {
    return {
      rawLabel: label,
      normalizedLabel: normalized,
      type: "year_summary",
      year: Number(normalized),
      month: null,
      periodKey: normalized,
      zone: "summary",
    };
  }

  const monthMatch =
    /^([a-z\u00e1\u00e9\u00ed\u00f3\u00fa]{3,4})[-/\s](\d{2}|\d{4})$/i.exec(
      normalized,
    );

  if (!monthMatch) {
    return {
      rawLabel: label,
      normalizedLabel: label.trim(),
      type: "unknown",
      year: null,
      month: null,
      periodKey: null,
      zone: "unknown",
    };
  }

  const monthToken = monthMatch[1]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const month = MONTH_LOOKUP.get(monthToken);

  if (!month) {
    return {
      rawLabel: label,
      normalizedLabel: label.trim(),
      type: "unknown",
      year: null,
      month: null,
      periodKey: null,
      zone: "unknown",
    };
  }

  const yearToken = monthMatch[2];
  const year =
    yearToken.length === 2 ? Number(`20${yearToken}`) : Number(yearToken);
  const periodKey = toMonthPeriodKey(year, month);

  return {
    rawLabel: label,
    normalizedLabel: toCanonicalMonthLabel(year, month),
    type: "month",
    year,
    month,
    periodKey,
    zone: detectPeriodZone(
      periodKey,
      actualsEndPeriodKey,
      forecastEndPeriodKey,
    ),
  };
}

export function detectPeriodZone(
  periodKey: string,
  actualsEndPeriodKey?: string | null,
  forecastEndPeriodKey?: string | null,
): PeriodZone {
  if (periodKey.length === 4) {
    return "summary";
  }

  if (!actualsEndPeriodKey) {
    return "forecast";
  }

  if (comparePeriodKeys(periodKey, actualsEndPeriodKey) <= 0) {
    return "historical";
  }

  if (!forecastEndPeriodKey) {
    return "forecast";
  }

  if (comparePeriodKeys(periodKey, forecastEndPeriodKey) <= 0) {
    return "forecast";
  }

  return "forecast";
}

export function groupPeriodsForBoard(periods: PeriodRecord[]) {
  const historical = periods.filter((period) => period.zone === "historical");
  const forecast = periods.filter((period) => period.zone === "forecast");
  const summary = periods.filter((period) => period.zone === "summary");

  return {
    historical,
    forecast,
    summary,
    ordered: [...historical, ...forecast, ...summary],
  };
}

export function deriveYearGroups(periods: PeriodRecord[]): YearGroupRecord[] {
  const groupMap = new Map<number, YearGroupRecord>();

  periods.forEach((period) => {
    const existing = groupMap.get(period.year) || {
      year: period.year,
      summary_period_key: String(period.year),
      month_period_keys: [],
    };

    if (period.type === "year_summary") {
      existing.summary_period_key = period.key;
    }

    if (period.type === "month") {
      existing.month_period_keys.push(period.key);
    }

    groupMap.set(period.year, existing);
  });

  return Array.from(groupMap.values()).sort(
    (left, right) => left.year - right.year,
  );
}

export function applyTimelineToPeriods(
  periods: PeriodRecord[],
  actualsEndPeriodKey: string,
  forecastEndPeriodKey: string,
) {
  return periods.map((period) => ({
    ...period,
    zone:
      period.type === "year_summary"
        ? "summary"
        : detectPeriodZone(
            period.key,
            actualsEndPeriodKey,
            forecastEndPeriodKey,
          ),
  }));
}

function parseMonthKey(periodKey: string) {
  const [yearText, monthText] = periodKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!year || !month || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

export function extendPeriodsToTimeline(
  periods: PeriodRecord[],
  actualsEndPeriodKey: string,
  forecastEndPeriodKey: string,
) {
  const baseMonthPeriods = periods
    .filter((period) => period.type === "month")
    .sort((left, right) => comparePeriodKeys(left.key, right.key));

  if (baseMonthPeriods.length === 0) {
    return periods;
  }

  const start = parseMonthKey(baseMonthPeriods[0].key);
  const baseEnd = parseMonthKey(baseMonthPeriods.at(-1)?.key || "");
  const requestedEnd = parseMonthKey(forecastEndPeriodKey);
  const requestedActual = parseMonthKey(actualsEndPeriodKey);

  if (!start || !baseEnd) {
    return applyTimelineToPeriods(
      periods,
      actualsEndPeriodKey,
      forecastEndPeriodKey,
    );
  }

  let endYear = baseEnd.year;
  let endMonth = baseEnd.month;

  if (
    requestedEnd &&
    comparePeriodKeys(
      toMonthPeriodKey(requestedEnd.year, requestedEnd.month),
      toMonthPeriodKey(endYear, endMonth),
    ) > 0
  ) {
    endYear = requestedEnd.year;
    endMonth = requestedEnd.month;
  }

  if (
    requestedActual &&
    comparePeriodKeys(
      toMonthPeriodKey(requestedActual.year, requestedActual.month),
      toMonthPeriodKey(endYear, endMonth),
    ) > 0
  ) {
    endYear = requestedActual.year;
    endMonth = requestedActual.month;
  }

  const existingByKey = new Map(periods.map((period) => [period.key, period]));
  const months: PeriodRecord[] = [];

  let cursorYear = start.year;
  let cursorMonth = start.month;

  while (
    comparePeriodKeys(
      toMonthPeriodKey(cursorYear, cursorMonth),
      toMonthPeriodKey(endYear, endMonth),
    ) <= 0
  ) {
    const key = toMonthPeriodKey(cursorYear, cursorMonth);
    const existing = existingByKey.get(key);

    months.push({
      key,
      label: existing?.label || toCanonicalMonthLabel(cursorYear, cursorMonth),
      type: "month",
      year: cursorYear,
      month: cursorMonth,
      zone: detectPeriodZone(key, actualsEndPeriodKey, forecastEndPeriodKey),
    });

    if (cursorMonth === 12) {
      cursorYear += 1;
      cursorMonth = 1;
    } else {
      cursorMonth += 1;
    }
  }

  const existingSummaries = periods.filter(
    (period) => period.type === "year_summary",
  );
  const summaryByYear = new Map(
    existingSummaries.map((period) => [period.year, period]),
  );
  const years = Array.from(new Set(months.map((period) => period.year))).sort(
    (left, right) => left - right,
  );

  const result: PeriodRecord[] = [];

  years.forEach((year) => {
    months
      .filter((period) => period.year === year)
      .forEach((period) => result.push(period));

    const existingSummary = summaryByYear.get(year);
    result.push({
      key: existingSummary?.key || String(year),
      label: existingSummary?.label || String(year),
      type: "year_summary",
      year,
      month: null,
      zone: "summary",
    });
  });

  return result;
}

export function getMonthPeriods(periods: PeriodRecord[]) {
  return periods
    .filter((period) => period.type === "month")
    .sort((left, right) => comparePeriodKeys(left.key, right.key));
}

export function getInitialTimelineFromPeriods(periods: PeriodRecord[]) {
  const monthPeriods = getMonthPeriods(periods);
  const historical = monthPeriods.filter(
    (period) => period.zone === "historical",
  );
  const forecast = monthPeriods.filter((period) => period.zone === "forecast");

  return {
    actualsEndPeriodKey:
      historical.at(-1)?.key || monthPeriods.at(0)?.key || "",
    forecastEndPeriodKey:
      forecast.at(-1)?.key ||
      historical.at(-1)?.key ||
      monthPeriods.at(-1)?.key ||
      "",
  };
}

export function formatPeriodShortLabel(periodKey: string | null | undefined) {
  if (!periodKey) {
    return "sin rango";
  }

  if (/^\d{4}$/.test(periodKey)) {
    return periodKey;
  }

  const [yearText, monthText] = periodKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!year || !month) {
    return periodKey;
  }

  return toCanonicalMonthLabel(year, month);
}

export function buildPredictionSummary(
  prediction: PredictionConfig | PredictionConfigOut,
) {
  const methodLabel = getPredictionMethodLabel(
    prediction.method,
    "method_label" in prediction ? prediction.method_label : null,
  );
  const startLabel = formatPeriodShortLabel(
    prediction.forecast_start_period_key,
  );
  const endLabel = formatPeriodShortLabel(prediction.forecast_end_period_key);

  if (
    prediction.method === "growth_rate_pct" &&
    typeof prediction.params.rate === "number"
  ) {
    return `Proyecta de ${startLabel} a ${endLabel} con ${methodLabel.toLowerCase()} de ${prediction.params.rate}%`;
  }

  if (
    prediction.method === "formula_placeholder" &&
    typeof prediction.params.expression === "string" &&
    prediction.params.expression.trim().length > 0
  ) {
    return `Proyecta de ${startLabel} a ${endLabel} con ${methodLabel.toLowerCase()} (${prediction.params.expression})`;
  }

  if (
    prediction.method === "moving_average" &&
    typeof prediction.params.window === "number"
  ) {
    return `Proyecta de ${startLabel} a ${endLabel} con ${methodLabel.toLowerCase()} de ${prediction.params.window} meses`;
  }

  if (
    prediction.method === "linear_trend" &&
    typeof prediction.params.lookback_periods === "number"
  ) {
    return `Proyecta de ${startLabel} a ${endLabel} con ${methodLabel.toLowerCase()} usando ${prediction.params.lookback_periods} meses`;
  }

  if (
    prediction.method === "seasonal_naive" &&
    typeof prediction.params.season_length === "number"
  ) {
    return `Proyecta de ${startLabel} a ${endLabel} con ${methodLabel.toLowerCase()} de ${prediction.params.season_length} meses`;
  }

  if (
    prediction.method === "arima_like" &&
    typeof prediction.params.lookback_periods === "number"
  ) {
    return `Proyecta de ${startLabel} a ${endLabel} con ${methodLabel.toLowerCase()} usando ${prediction.params.lookback_periods} meses`;
  }

  return `Proyecta de ${startLabel} a ${endLabel} con ${methodLabel.toLowerCase()}`;
}
