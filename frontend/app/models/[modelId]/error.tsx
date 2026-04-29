"use client";

import { Button } from "@/components/ui/Button";

type ModelErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ModelError({ error, reset }: ModelErrorProps) {
  return (
    <main className="app-shell flex min-h-screen items-center justify-center p-6">
      <section className="panel-surface w-full max-w-xl rounded-[28px] p-8">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-[var(--danger)]">
          Error de carga
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--heading)]">
          No se pudo abrir el tablero.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
          {error.message ||
            "La API no respondió como se esperaba. Reintenta o valida la configuración."}
        </p>
        <div className="mt-6">
          <Button onClick={reset}>Reintentar</Button>
        </div>
      </section>
    </main>
  );
}
