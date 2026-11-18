import Table from "../../blocks/table";
import StatGrid from "../../blocks/statGrid";
import { Block, Rows } from "../../grid/layout";
import { gameStore } from "../../game/store";

const STATES = ["tavern", "travelling", "waiting", "working", "returning"];

function hoursLeft(hours: number | null) {
  return hours === null ? "—" : `${hours.toFixed(1)} h`;
}

export default function GameDwarfsPanel() {
  const dwarfs = () => gameStore.report().dwarfs;
  const rows = () =>
    (dwarfs()?.rows ?? []).map((dwarf) => [
      dwarf.name,
      `${dwarf.rank} · ${dwarf.class}`,
      dwarf.state,
      dwarf.station ?? "—",
      hoursLeft(dwarf.shiftHoursLeft),
      dwarf.beer ?? "—",
      String(dwarf.speed),
      String(dwarf.power),
      String(dwarf.bph),
      dwarf.traits.join(", ") || "—",
      dwarf.gear.join(", ") || "—",
    ]);

  return (
    <Rows>
      <Block size="fit">
        <StatGrid
          stats={[
            { label: "Dwarfs", value: String(dwarfs()?.rows.length ?? 0) },
            ...STATES.map((state) => ({ label: state, value: String(dwarfs()?.counts[state] ?? 0) })),
          ]}
        />
      </Block>
      <Block size="fill">
        <Table
          columns={[
            { label: "Name", width: "minmax(6rem,1fr)" },
            { label: "Rank · class", width: "auto" },
            { label: "State", width: "auto" },
            { label: "Station", width: "minmax(5rem,1fr)" },
            { label: "Shift left", width: "auto", align: "right" },
            { label: "Beer", width: "auto" },
            { label: "Speed", width: "auto", align: "right" },
            { label: "Power", width: "auto", align: "right" },
            { label: "BPH", width: "auto", align: "right" },
            { label: "Traits", width: "minmax(8rem,2fr)" },
            { label: "Gear", width: "minmax(8rem,2fr)" },
          ]}
          rows={rows()}
          empty="no dwarfs"
        />
      </Block>
    </Rows>
  );
}
