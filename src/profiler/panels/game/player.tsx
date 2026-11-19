import Table from "../../blocks/table";
import StatGrid from "../../blocks/statGrid";
import { Block, Rows } from "../../grid/layout";
import { gameStore } from "../../game/store";

export default function GamePlayerPanel() {
  const player = () => gameStore.report().player;
  const rows = () => (player()?.mined ?? []).map((row) => [row.block, String(row.count)]);

  return (
    <Rows>
      <Block size="fit">
        <StatGrid
          stats={[
            { label: "Name", value: player()?.name || "—" },
            { label: "Mined", value: String(player()?.minedTotal ?? 0), unit: "blocks" },
          ]}
        />
      </Block>
      <Block size="fill">
        <Table
          columns={[
            { label: "Block", width: "minmax(6rem,1fr)" },
            { label: "Mined", width: "auto", align: "right" },
          ]}
          rows={rows()}
          empty="nothing mined yet"
        />
      </Block>
    </Rows>
  );
}
