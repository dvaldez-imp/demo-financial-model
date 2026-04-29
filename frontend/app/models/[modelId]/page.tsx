import type { Metadata } from "next";
import Link from "next/link";
import DemoResetButton from "@/components/model-board/DemoResetButton";
import { getModelBoard } from "@/lib/api/models";

export async function generateMetadata(
  props: PageProps<"/models/[modelId]">,
): Promise<Metadata> {
  const params = await props.params;

  try {
    const board = await getModelBoard(params.modelId);

    return {
      title: `${board.model.name} · Resumen del modelo`,
      description: `Resumen ejecutivo del modelo ${board.model.name}: premisas, escenarios y accesos rápidos.`,
    };
  } catch {
    return {
      title: "Resumen del modelo",
    };
  }
}

export default async function ModelPage(props: PageProps<"/models/[modelId]">) {
  const params = await props.params;
  const board = await getModelBoard(params.modelId);
  const importedOutputPremises = board.premises.filter(
    (premise) => premise.source === "model_output",
  );
  const connectedModelNames = Array.from(
    new Set(
      importedOutputPremises
        .map((premise) => premise.source_model_id)
        .filter((modelId): modelId is string => Boolean(modelId)),
    ),
  );
  const previewPremises = board.premises.slice(0, 6);
  const quickLinks = [
    {
      href: `/models/${params.modelId}/board`,
      label: "Abrir board",
      description: "Entrar al tablero principal",
      primary: true,
    },
    {
      href: `/models/${params.modelId}/library`,
      label: "Biblioteca",
      description: "Gestionar premisas y catálogo",
    },
    {
      href: `/models/${params.modelId}/outputs`,
      label: "Outputs",
      description: "Revisar salidas exportables",
    },
    {
      href: `/models/${params.modelId}/dependencies`,
      label: "Dependencias",
      description: "Entender relaciones entre premisas",
    },
  ];
  const summaryCards = [
    {
      label: "Premisas activas",
      value: board.premises.length.toString(),
      detail: "Variables y drivers cargados en el modelo.",
    },
    {
      label: "Escenarios",
      value: board.scenarios.length.toString(),
      detail: "Escenarios disponibles para comparar sensibilidad.",
    },
    {
      label: "Periodos en timeline",
      value: board.periods.length.toString(),
      detail: "Cobertura temporal total del tablero.",
    },
    {
      label: "Outputs importados",
      value: importedOutputPremises.length.toString(),
      detail: "Premisas alimentadas por resultados externos.",
    },
  ];

  return (
    <section className="panel-surface rounded-[32px] p-6 sm:p-8">
      <header className="border-b border-[var(--border)] pb-6 sm:pb-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold tracking-[0.04em] text-[var(--accent)]">
              Resumen del modelo
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--heading)] sm:text-[42px]">
              {board.model.name}
            </h1>
            <p className="mt-4 text-base leading-7 text-[var(--foreground-muted)]">
              Revisa el alcance del modelo antes de entrar al board. Esta vista
              prioriza orientación rápida, cobertura temporal y accesos
              frecuentes para reducir pasos innecesarios.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-label={`${link.description} del modelo ${board.model.name}`}
                style={link.primary ? { color: "#ffffff" } : undefined}
                className={`inline-flex min-h-12 items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)] ${
                  link.primary
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_12px_28px_rgba(0,56,101,0.16)] hover:border-[var(--accent-strong)] hover:bg-[var(--accent-strong)]"
                    : "border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <section className="mt-6" aria-labelledby="model-summary-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="model-summary-title"
              className="text-xl font-semibold text-[var(--heading)]"
            >
              Lectura rápida
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--foreground-muted)]">
              Un resumen limpio ayuda a ubicarse sin escanear demasiados
              bloques visuales.
            </p>
          </div>
        </div>

        <dl className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="card-outline rounded-[28px] p-5 sm:p-6"
            >
              <dt className="text-sm font-medium text-[var(--foreground-muted)]">
                {card.label}
              </dt>
              <dd className="mt-3 text-3xl font-semibold tracking-tight text-[var(--heading)]">
                {card.value}
              </dd>
              <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                {card.detail}
              </p>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section
          className="card-outline rounded-[28px] p-5 sm:p-6"
          aria-labelledby="model-coverage-title"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2
                id="model-coverage-title"
                className="text-xl font-semibold text-[var(--heading)]"
              >
                Cobertura temporal
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--foreground-muted)]">
                La frecuencia y el rango histórico/proyectado deben poder
                leerse sin esfuerzo.
              </p>
            </div>

            <span className="inline-flex w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              {board.model.frequency || "Frecuencia sin definir"}
            </span>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <dt className="text-sm font-medium text-[var(--foreground-muted)]">
                Histórico hasta
              </dt>
              <dd className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                {board.model.actuals_end_period_key || "Sin definir"}
              </dd>
            </div>
            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <dt className="text-sm font-medium text-[var(--foreground-muted)]">
                Proyectado hasta
              </dt>
              <dd className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                {board.model.forecast_end_period_key || "Sin definir"}
              </dd>
            </div>
          </dl>
        </section>

        <section
          className="card-outline rounded-[28px] p-5 sm:p-6"
          aria-labelledby="model-scenarios-title"
        >
          <h2
            id="model-scenarios-title"
            className="text-xl font-semibold text-[var(--heading)]"
          >
            Escenarios y conexiones
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--foreground-muted)]">
            Se reduce ruido visual agrupando chips y relaciones externas en un
            solo bloque contextual.
          </p>

          <div className="mt-5">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Escenarios del modelo
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {board.scenarios.length > 0 ? (
                board.scenarios.map((scenario) => (
                  <span
                    key={scenario.id}
                    className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--foreground)]"
                  >
                    {scenario.name}
                  </span>
                ))
              ) : (
                <p className="text-sm text-[var(--foreground-muted)]">
                  No hay escenarios configurados todavía.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Modelos conectados
            </p>
            {connectedModelNames.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {connectedModelNames.map((modelName) => (
                  <span
                    key={modelName}
                    className="inline-flex rounded-full bg-[var(--accent-secondary-soft)] px-3 py-2 text-sm font-medium text-[var(--foreground)]"
                  >
                    {modelName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
                Este modelo no depende de outputs importados desde otros
                modelos.
              </p>
            )}
          </div>
        </section>
      </div>

      <section
        className="mt-6 card-outline rounded-[28px] p-5 sm:p-6"
        aria-labelledby="model-premises-title"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2
              id="model-premises-title"
              className="text-xl font-semibold text-[var(--heading)]"
            >
              Premisas representativas
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--foreground-muted)]">
              Se muestran las primeras seis para validar categoría, unidad y
              método de proyección sin abrir cada detalle.
            </p>
          </div>
          <p className="text-sm font-medium text-[var(--foreground-muted)]">
            {board.premises.length} premisas registradas
          </p>
        </div>

        {previewPremises.length > 0 ? (
          <ul className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {previewPremises.map((premise) => (
              <li key={premise.id}>
                <article className="h-full rounded-[24px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold leading-6 text-[var(--foreground)]">
                      {premise.name}
                    </h3>
                    {premise.source === "model_output" ? (
                      <span className="inline-flex rounded-full bg-[var(--accent-secondary-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-secondary)]">
                        Importada
                      </span>
                    ) : null}
                  </div>

                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-[var(--foreground-muted)]">
                        Categoría
                      </dt>
                      <dd className="text-right font-medium text-[var(--foreground)]">
                        {premise.category || "Sin categoría"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-[var(--foreground-muted)]">Unidad</dt>
                      <dd className="text-right font-medium text-[var(--foreground)]">
                        {premise.unit || "Sin unidad"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-[var(--foreground-muted)]">Método</dt>
                      <dd className="max-w-[65%] text-right font-medium text-[var(--foreground)]">
                        {premise.prediction_override?.method_label ||
                          premise.prediction_base.method_label}
                      </dd>
                    </div>
                  </dl>

                  {premise.source === "model_output" ? (
                    <p className="mt-4 text-sm leading-6 text-[var(--foreground-muted)]">
                      Fuente:{" "}
                      <span className="font-medium text-[var(--foreground)]">
                        {premise.source_model_id || "otro modelo"}
                      </span>
                    </p>
                  ) : null}
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-5 text-sm leading-6 text-[var(--foreground-muted)]">
            Todavía no hay premisas cargadas para este modelo.
          </p>
        )}
      </section>

      <DemoResetButton modelId={params.modelId} />
    </section>
  );
}
