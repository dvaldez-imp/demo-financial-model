import ModelWorkspaceNav from "@/components/model-board/ModelWorkspaceNav";
import { getModels } from "@/lib/api/models";

export default async function ModelLayout({
  children,
  params,
}: LayoutProps<"/models/[modelId]">) {
  const resolved = await params;
  const models = await getModels();

  return (
    <div className="app-shell h-screen overflow-hidden">
      <a className="skip-link" href="#model-main">
        Saltar al contenido principal
      </a>
      <div className="flex h-full w-full flex-col overflow-hidden">
        <ModelWorkspaceNav modelId={resolved.modelId} models={models} />
        <div className="subtle-scrollbar flex-1 min-h-0 w-full overflow-y-auto">
          <main id="model-main" className="mx-4 mt-2 min-w-0 pb-4">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
