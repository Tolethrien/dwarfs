import Table from "../../blocks/table";
import StatGrid from "../../blocks/statGrid";
import { Block, Rows } from "../../grid/layout";
import { gameStore } from "../../game/store";

export default function GameNetworkPanel() {
  const rails = () => gameStore.report().rails;
  const rows = () =>
    (gameStore.report().stations ?? []).map((station) => [
      station.name,
      station.position,
      station.atShaft ? "shaft's bottom" : station.connected ? "connected" : "cut off",
      String(station.priority),
      String(station.queue),
      `${station.ordered} / ${station.manualLimit}`,
    ]);

  return (
    <Rows>
      <Block size="fit">
        <StatGrid
          stats={[
            { label: "Segments", value: String(rails()?.segments ?? 0) },
            { label: "Rail tiles", value: String(rails()?.tiles ?? 0) },
            { label: "Joints", value: String(rails()?.joints ?? 0) },
            { label: "Damaged", value: String(rails()?.damaged ?? 0) },
            { label: "Broken", value: String(rails()?.broken ?? 0) },
            { label: "Stations", value: String(gameStore.report().stations?.length ?? 0) },
          ]}
        />
      </Block>
      <Block size="fill">
        <Table
          columns={[
            { label: "Station", width: "minmax(6rem,1fr)" },
            { label: "Tile", width: "auto" },
            { label: "Link", width: "auto" },
            { label: "Priority", width: "auto", align: "right" },
            { label: "Sling queue", width: "auto", align: "right" },
            { label: "Ordered", width: "auto", align: "right" },
          ]}
          rows={rows()}
          empty="no stations"
        />
      </Block>
    </Rows>
  );
}
