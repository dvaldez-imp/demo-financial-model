"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getModels, resetDemoData } from "@/lib/api/models";

type DemoResetButtonProps = {
  modelId: string;
};

export default function DemoResetButton({ modelId }: DemoResetButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    const confirmed = window.confirm(
      "Esto reiniciara los datos demo del backend. Deseas continuar?",
    );

    if (!confirmed) {
      return;
    }

    setPending(true);
    setMessage(null);
    setError(null);

    try {
      const result = await resetDemoData(true);
      setMessage(`Demo reiniciada. Modelos cargados: ${result.models_count}.`);
      const models = await getModels();
      const preferredModelId =
        models.find((item) => item.id.toLowerCase() === "model_holding")?.id ||
        models.find((item) => item.id.toLowerCase().includes("holding"))?.id ||
        models.find((item) => item.id.toLowerCase() === "model_arima")?.id ||
        models.find((item) => item.id.toLowerCase().includes("arima"))?.id ||
        models.find((item) => item.id.toLowerCase() === "model_demo")?.id ||
        models.find((item) => item.id.toLowerCase().includes("demo"))?.id ||
        modelId;
      router.refresh();
      router.push(`/models/${preferredModelId}`);
    } catch (resetError) {
      const nextMessage =
        resetError instanceof Error
          ? resetError.message
          : "No se pudo reiniciar el demo.";
      setError(nextMessage);
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="mt-6 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-3">
      <summary className="cursor-pointer select-none text-sm font-medium text-[var(--foreground-muted)]">
        Herramientas internas
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="min-h-10 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
          disabled={pending}
          onClick={handleReset}
          title="Reinicia datos demo del backend"
        >
          {pending ? "Reiniciando..." : "Reiniciar demo"}
        </button>
        {message ? (
          <p className="text-xs text-[var(--success)]">{message}</p>
        ) : null}
        {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      </div>
    </details>
  );
}
