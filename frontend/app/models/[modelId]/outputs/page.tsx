import ModelOutputsPage from "@/components/model-board/ModelOutputsPage";
import { getModelBoard, getModelOutputs } from "@/lib/api/models";

export default async function ModelOutputsRoutePage(
  props: PageProps<"/models/[modelId]/outputs">,
) {
  const params = await props.params;

  const [board, outputs] = await Promise.all([
    getModelBoard(params.modelId),
    getModelOutputs(params.modelId),
  ]);

  return (
    <ModelOutputsPage
      modelId={params.modelId}
      premises={board.premises}
      initialOutputs={outputs}
    />
  );
}
