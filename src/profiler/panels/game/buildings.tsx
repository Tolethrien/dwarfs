import Table from "../../blocks/table";
import StatGrid from "../../blocks/statGrid";
import { Block, Rows } from "../../grid/layout";
import { gameStore } from "../../game/store";

export default function GameBuildingsPanel() {
  const buildings = () => gameStore.report().buildings;
  const tavern = () => gameStore.report().tavern;
  const rows = () =>
    (buildings()?.rows ?? []).map((building) => [building.name, building.side, building.base, building.reserve]);

  return (
    <Rows>
      <Block size="fit">
        <StatGrid
          stats={[
            { label: "Shaft depth", value: String(buildings()?.shaftDepth ?? 0), unit: "tiles" },
            { label: "Applications", value: `${tavern()?.applications ?? 0} / ${tavern()?.limit ?? 0}` },
            { label: "New per day", value: String(tavern()?.perDay ?? 0) },
            { label: "Arrive at", value: `${tavern()?.arrivalHour ?? 0}:00` },
            { label: "Hire cost", value: tavern()?.hireCost ?? "—" },
          ]}
        />
      </Block>
      <Block size="fill">
        <Table
          columns={[
            { label: "Building", width: "auto" },
            { label: "Side", width: "auto" },
            { label: "Body (tile · size)", width: "minmax(8rem,1fr)" },
            { label: "Room kept for upgrades", width: "minmax(8rem,1fr)" },
          ]}
          rows={rows()}
          empty="no buildings"
        />
      </Block>
    </Rows>
  );
}
