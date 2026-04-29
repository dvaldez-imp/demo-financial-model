import ModelBoardScreen from "@/components/model-board/ModelBoardScreen";
import { getModelBoard } from "@/lib/api/models";
import type { BoardViewMode } from "@/lib/types/board";

function getBoardViewMode(value: string | string[] | undefined): BoardViewMode {
  return value === "charts" ? "charts" : "table";
}

export default async function ModelBoardPage(
  props: PageProps<"/models/[modelId]/board">,
) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const scenarioId =
    typeof searchParams.scenario_id === "string"
      ? searchParams.scenario_id
      : undefined;
  const initialView = getBoardViewMode(searchParams.view);

  const board = await getModelBoard(params.modelId, scenarioId);

  return <ModelBoardScreen initialBoard={board} initialView={initialView} />;
}
