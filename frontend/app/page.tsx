import { redirect } from "next/navigation";
import { getModels } from "@/lib/api/models";

export default async function HomePage() {
  const models = await getModels();

  if (models.length > 0) {
    const preferredModel =
      models.find((model) => model.id.toLowerCase() === "model_holding") ||
      models.find((model) => model.id.toLowerCase().includes("holding")) ||
      models.find((model) => model.id.toLowerCase() === "model_arima") ||
      models.find((model) => model.id.toLowerCase().includes("arima")) ||
      models.find((model) => model.id.toLowerCase() === "model_demo") ||
      models.find((model) => model.id.toLowerCase().includes("demo")) ||
      models[0];
    redirect(`/models/${preferredModel.id}`);
  }

  return (
    <main className="app-shell flex min-h-screen items-center justify-center p-6">
      <section className="panel-surface w-full max-w-xl rounded-[28px] p-8 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-[var(--foreground-muted)]">
          Model Platform
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          No hay modelos disponibles.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
          Levanta el backend con un modelo inicial o crea uno desde la API para
          comenzar.
        </p>
      </section>
    </main>
  );
}
