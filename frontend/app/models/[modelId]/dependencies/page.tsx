import DependenciesPage from "@/components/model-board/DependenciesPage";
import { getModelBoard } from "@/lib/api/models";

export default async function ModelDependenciesRoutePage(
  props: PageProps<"/models/[modelId]/dependencies">,
) {
  const params = await props.params;
  const board = await getModelBoard(params.modelId);

  return (
    <DependenciesPage modelId={params.modelId} premises={board.premises} />
  );
}
