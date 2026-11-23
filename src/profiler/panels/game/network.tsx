import Table from "../../blocks/table";
import StatStrip from "../../blocks/statStrip";
import { Block, Rows } from "../../grid/layout";
import { gameStore } from "../../game/store";
import type { GameStationRow } from "@/core/debugger/modules/game/report";

function link(station: GameStationRow) {
  if (station.atShaft) return "shaft";
  return station.connected ? "connected" : "cut off";
}

export default function GameNetworkPanel() {
  const rails = () => gameStore.report().rails;
  const rows = () =>
    (gameStore.report().stations ?? []).map((station) => [
      station.name,
      station.position,
      link(station),
      String(station.priority),
      String(station.queue),
      `${station.ordered} / ${station.manualLimit}`,
    ]);

  return (
    <Rows>
      <Block size="fit">
        <StatStrip
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
          hug
          columns={[
            { label: "Station" },
            { label: "Tile" },
            { label: "Link" },
            { label: "Prio", align: "right" },
            { label: "Queue", align: "right" },
            { label: "Ordered", align: "right" },
          ]}
          rows={rows()}
          empty="no stations"
        />
      </Block>
    </Rows>
  );
}
