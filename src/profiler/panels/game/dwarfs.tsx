import Table from "../../blocks/table";
import StatStrip from "../../blocks/statStrip";
import { Block, Rows } from "../../grid/layout";
import { gameStore } from "../../game/store";
import type { GameDwarfRow } from "@/core/debugger/modules/game/report";

const STATES = ["tavern", "travelling", "waiting", "working", "returning"];

function where(dwarf: GameDwarfRow) {
  const parts = [dwarf.state];
  if (dwarf.station !== null) parts.push(dwarf.station);
  if (dwarf.shiftHoursLeft !== null) parts.push(`${dwarf.shiftHoursLeft.toFixed(1)}h`);
  return parts.join(" · ");
}

export default function GameDwarfsPanel() {
  const dwarfs = () => gameStore.report().dwarfs;
  const rows = () =>
    (dwarfs()?.rows ?? []).map((dwarf) => [
      `${dwarf.rank === "foreman" ? "★ " : ""}${dwarf.name}`,
      dwarf.class,
      where(dwarf),
      dwarf.morale === null ? "—" : String(dwarf.morale),
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
        <StatStrip
          stats={[
            { label: "Dwarfs", value: String(dwarfs()?.rows.length ?? 0) },
            ...STATES.map((state) => ({ label: state, value: String(dwarfs()?.counts[state] ?? 0) })),
          ]}
        />
      </Block>
      <Block size="fill">
        <Table
          hug
          columns={[
            { label: "Name" },
            { label: "Class" },
            { label: "Where" },
            { label: "Morale", align: "right" },
            { label: "Beer" },
            { label: "Spd", align: "right" },
            { label: "Pwr", align: "right" },
            { label: "BPH", align: "right" },
            { label: "Traits" },
            { label: "Gear" },
          ]}
          rows={rows()}
          empty="no dwarfs"
        />
      </Block>
    </Rows>
  );
}
