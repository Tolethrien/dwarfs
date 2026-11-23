import Table from "../../blocks/table";
import StatStrip from "../../blocks/statStrip";
import { Block, Rows } from "../../grid/layout";
import { gameStore } from "../../game/store";

export default function GameWorkforcePanel() {
  const workforce = () => gameStore.report().workforce;
  const gear = () =>
    (workforce()?.gear ?? []).map((row) => [
      row.name,
      row.level === 0 ? "locked" : `${row.level} / ${row.max}`,
      row.classes.join(", ") || "—",
    ]);

  return (
    <Rows>
      <Block size="fit">
        <StatStrip
          stats={(workforce()?.research ?? []).map((trait) => ({
            label: trait.name,
            value: trait.researched ? "✓" : "—",
          }))}
        />
      </Block>
      <Block size="fill">
        <Table
          hug
          columns={[
            { label: "Gear" },
            { label: "Level", align: "right" },
            { label: "Given to" },
          ]}
          rows={gear()}
          empty="no base gear"
        />
      </Block>
    </Rows>
  );
}
