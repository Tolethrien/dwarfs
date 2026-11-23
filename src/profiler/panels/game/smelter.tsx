import Table from "../../blocks/table";
import { gameStore } from "../../game/store";

export default function GameSmelterPanel() {
  const rows = () =>
    (gameStore.report().economy?.recipes ?? []).map((recipe) => [
      recipe.name,
      recipe.takes,
      recipe.gives,
      `${recipe.hours.toFixed(2)} h`,
    ]);

  return (
    <Table
      hug
      columns={[
        { label: "Recipe" },
        { label: "Takes" },
        { label: "Gives" },
        { label: "Batch", align: "right" },
      ]}
      rows={rows()}
      empty="no recipes"
    />
  );
}
