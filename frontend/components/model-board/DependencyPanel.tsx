import { Badge } from "@/components/ui/Badge";
import type { BoardPremise, DependenciesResponse } from "@/lib/types/api";

type DependencyPanelProps = {
  dependencyGraph: DependenciesResponse;
  premise: BoardPremise | null;
};

function relationLabel(relation: string) {
  if (relation === "exports") {
    return "Exporta a";
  }

  if (relation === "derives_from") {
    return "Deriva de";
  }

  return "Usa";
}

export default function DependencyPanel({
  dependencyGraph,
  premise,
}: DependencyPanelProps) {
  if (!premise) {
    return (
      <div className="rounded-[24px] border border-dashed border-[var(--border-strong)] bg-white p-5 text-sm text-[var(--foreground-muted)]">
        Selecciona una premisa para ver sus dependencias.
      </div>
    );
  }

  const nodeMap = new Map(dependencyGraph.nodes.map((node) => [node.id, node]));
  const incoming = dependencyGraph.edges.filter((edge) => edge.to_id === premise.id);
  const outgoing = dependencyGraph.edges.filter((edge) => edge.from_id === premise.id);

  return (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-[var(--border)] bg-white p-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Dependencias de {premise.name}
        </h2>
        <p className="mt-2 text-sm text-[var(--foreground-muted)]">
          {premise.dependency_label}
          {premise.source_model_id ? ` · Modelo origen ${premise.source_model_id}` : ""}
        </p>
      </section>

      <section className="rounded-[24px] border border-[var(--border)] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Depende de
          </h3>
          <Badge tone="accent">{incoming.length}</Badge>
        </div>
        <div className="mt-3 space-y-3">
          {incoming.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">
              No hay dependencias registradas para esta premisa.
            </p>
          ) : (
            incoming.map((edge) => {
              const node = nodeMap.get(edge.from_id);

              return (
                <div
                  key={`${edge.from_id}-${edge.to_id}-${edge.relation}`}
                  className="rounded-[20px] bg-[var(--surface-muted)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {node?.name || edge.from_id}
                  </p>
                  <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                    {relationLabel(edge.relation)}
                    {node?.model_name ? ` · ${node.model_name}` : ""}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-[var(--border)] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Impacta a
          </h3>
          <Badge tone="warning">{outgoing.length}</Badge>
        </div>
        <div className="mt-3 space-y-3">
          {outgoing.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">
              No hay dependencias salientes ni outputs afectados.
            </p>
          ) : (
            outgoing.map((edge) => {
              const node = nodeMap.get(edge.to_id);

              return (
                <div
                  key={`${edge.from_id}-${edge.to_id}-${edge.relation}`}
                  className="rounded-[20px] bg-[var(--surface-muted)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {node?.name || edge.to_id}
                  </p>
                  <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                    {relationLabel(edge.relation)}
                    {node?.model_name ? ` · ${node.model_name}` : ""}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
