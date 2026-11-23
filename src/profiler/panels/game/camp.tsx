import Table from "../../blocks/table";
import StatStrip from "../../blocks/statStrip";
import { Block, Rows } from "../../grid/layout";
import { gameStore } from "../../game/store";

export default function GameCampPanel() {
  const buildings = () => gameStore.report().buildings;
  const tavern = () => gameStore.report().tavern;
  const rows = () =>
    (buildings()?.rows ?? []).map((building) => [building.name, building.side, building.base, building.reserve]);

  return (
    <Rows>
      <Block size="fit">
        <StatStrip
          stats={[
            { label: "Mine level", value: String(buildings()?.mineLevel ?? 0) },
            { label: "Shaft", value: String(buildings()?.shaftDepth ?? 0), unit: "tiles" },
            { label: "Applications", value: `${tavern()?.applications ?? 0} / ${tavern()?.limit ?? 0}` },
            { label: "Per day", value: String(tavern()?.perDay ?? 0) },
            { label: "Arrive", value: `${tavern()?.arrivalHour ?? 0}:00` },
            { label: "Hire", value: tavern()?.hireCost ?? "—" },
          ]}
        />
      </Block>
      <Block size="fill">
        <Table
          hug
          columns={[
            { label: "Building" },
            { label: "Side" },
            { label: "Body" },
            { label: "Reserve" },
          ]}
          rows={rows()}
          empty="no buildings"
        />
      </Block>
    </Rows>
  );
}
