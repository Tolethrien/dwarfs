import { Show } from "solid-js";
import Table from "../../blocks/table";
import StatStrip from "../../blocks/statStrip";
import { Block, Rows } from "../../grid/layout";
import { gameStore } from "../../game/store";

export default function GameBuffsPanel() {
  const buffs = () => gameStore.report().buffs;
  const active = () =>
    (buffs()?.active ?? []).map((buff) => [buff.name, `${buff.hoursLeft.toFixed(0)} / ${buff.hours} h`]);

  return (
    <Rows>
      <Show when={(buffs()?.totals.length ?? 0) > 0}>
        <Block size="fit">
          <StatStrip stats={(buffs()?.totals ?? []).map((total) => ({ label: total.stat, value: total.text }))} />
        </Block>
      </Show>
      <Block size="fill">
        <Table
          hug
          columns={[
            { label: "Buff" },
            { label: "Left", align: "right" },
          ]}
          rows={active()}
          empty="no active buffs"
        />
      </Block>
    </Rows>
  );
}
