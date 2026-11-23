import StatStrip from "../../blocks/statStrip";
import { Block, Rows } from "../../grid/layout";
import { gameStore } from "../../game/store";

export default function GamePlayerPanel() {
  const player = () => gameStore.report().player;

  return (
    <Rows>
      <Block size="fit">
        <StatStrip
          stats={[
            { label: "Name", value: player()?.name || "—" },
            { label: "Mined", value: String(player()?.minedTotal ?? 0), unit: "blocks" },
          ]}
        />
      </Block>
      <Block size="fit">
        <StatStrip stats={(player()?.mined ?? []).map((row) => ({ label: row.block, value: String(row.count) }))} />
      </Block>
    </Rows>
  );
}
