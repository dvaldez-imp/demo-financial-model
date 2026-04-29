import PremiseLibraryPage from "@/components/library/PremiseLibraryPage";
import { getLibraryPremises } from "@/lib/api/library";
import { getCatalogModelOutputs } from "@/lib/api/models";

export default async function ModelLibraryPage(
  props: PageProps<"/models/[modelId]/library">,
) {
  const params = await props.params;

  const [libraryPremises, catalogOutputs] = await Promise.all([
    getLibraryPremises(),
    getCatalogModelOutputs(),
  ]);

  return (
    <PremiseLibraryPage
      modelId={params.modelId}
      initialCatalogOutputs={catalogOutputs}
      initialPremises={libraryPremises}
    />
  );
}
