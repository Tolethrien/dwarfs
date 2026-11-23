import Table from "../../blocks/table";
import { gameStore } from "../../game/store";

export default function GameCostsPanel() {
  const rows = () => (gameStore.report().economy?.costs ?? []).map((row) => [row.name, row.cost]);

  return (
    <Table
      hug
      columns={[
        { label: "What" },
        { label: "Cost" },
      ]}
      rows={rows()}
      empty="no costs"
    />
  );
}
