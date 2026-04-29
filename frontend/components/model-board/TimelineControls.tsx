"use client";

import { useMemo, useState } from "react";
import QuestionMarkCircleIcon from "@heroicons/react/24/outline/QuestionMarkCircleIcon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { PeriodRecord } from "@/lib/types/api";
import { formatPeriodShortLabel } from "@/lib/utils/periods";

type TimelineControlsProps = {
  monthPeriods: PeriodRecord[];
  actualsEndPeriodKey: string;
  forecastEndPeriodKey: string;
  disabled?: boolean;
  onChangeActualsEnd: (periodKey: string) => void;
  onChangeForecastEnd: (periodKey: string) => void;
};

function TimelineHint({
  children,
  title,
}: {
  title: string;
  children: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)]"
        onClick={() => setOpen((current) => !current)}
      >
        <QuestionMarkCircleIcon className="h-4 w-4" />
        {title}
      </button>
      {open ? (
        <p className="mt-2 text-xs leading-5 text-[var(--foreground-muted)]">
          {children}
        </p>
      ) : null}
    </div>
  );
}

export default function TimelineControls({
  actualsEndPeriodKey,
  disabled = false,
  forecastEndPeriodKey,
  monthPeriods,
  onChangeActualsEnd,
  onChangeForecastEnd,
}: TimelineControlsProps) {
  const selectPeriods = useMemo(() => {
    const keys = new Set(monthPeriods.map((period) => period.key));
    const next = [...monthPeriods];

    if (actualsEndPeriodKey && !keys.has(actualsEndPeriodKey)) {
      next.push({
        key: actualsEndPeriodKey,
        label: formatPeriodShortLabel(actualsEndPeriodKey),
        type: "month",
        year: Number(actualsEndPeriodKey.slice(0, 4)),
        month: Number(actualsEndPeriodKey.slice(5, 7)),
        zone: "historical",
      });
      keys.add(actualsEndPeriodKey);
    }

    if (forecastEndPeriodKey && !keys.has(forecastEndPeriodKey)) {
      next.push({
        key: forecastEndPeriodKey,
        label: formatPeriodShortLabel(forecastEndPeriodKey),
        type: "month",
        year: Number(forecastEndPeriodKey.slice(0, 4)),
        month: Number(forecastEndPeriodKey.slice(5, 7)),
        zone: "forecast",
      });
    }

    return next.sort((left, right) => left.key.localeCompare(right.key));
  }, [actualsEndPeriodKey, forecastEndPeriodKey, monthPeriods]);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-[18px] border border-[var(--border)] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--heading)]">
              Historico hasta
            </p>
            <p className="text-xs text-[var(--foreground-muted)]">
              Corte actual: {formatPeriodShortLabel(actualsEndPeriodKey)}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-3">
          <Select
            label="Mes visible"
            value={actualsEndPeriodKey}
            disabled={disabled}
            onChange={(event) => onChangeActualsEnd(event.target.value)}
          >
            {selectPeriods.map((period) => (
              <option key={period.key} value={period.key}>
                {period.label}
              </option>
            ))}
          </Select>
          <Input
            type="month"
            label="Mes exacto"
            value={actualsEndPeriodKey}
            disabled={disabled}
            onChange={(event) => onChangeActualsEnd(event.target.value)}
          />
        </div>
        <TimelineHint title="Ayuda historico">
          Puedes seleccionar cualquier mes-anio, aunque todavia no exista en la
          grilla renderizada.
        </TimelineHint>
      </section>

      <section className="rounded-[18px] border border-[var(--border)] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--heading)]">
              Proyectar hasta
            </p>
            <p className="text-xs text-[var(--foreground-muted)]">
              Corte actual: {formatPeriodShortLabel(forecastEndPeriodKey)}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-3">
          <Select
            label="Mes visible"
            value={forecastEndPeriodKey}
            disabled={disabled}
            onChange={(event) => onChangeForecastEnd(event.target.value)}
          >
            {selectPeriods.map((period) => (
              <option key={period.key} value={period.key}>
                {period.label}
              </option>
            ))}
          </Select>
          <Input
            type="month"
            label="Mes exacto"
            value={forecastEndPeriodKey}
            disabled={disabled}
            onChange={(event) => onChangeForecastEnd(event.target.value)}
          />
        </div>
        <TimelineHint title="Ayuda proyeccion">
          Si backend lo soporta, el board se extiende hasta el mes que elijas.
        </TimelineHint>
      </section>
    </div>
  );
}
