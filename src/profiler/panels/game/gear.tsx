import Table from "../../blocks/table";
import { gameStore } from "../../game/store";

export default function GameGearPanel() {
  const rows = () =>
    (gameStore.report().workforce?.gear ?? []).map((gear) => [
      gear.name,
      gear.level === 0 ? "locked" : `${gear.level} / ${gear.max}`,
      gear.classes.length === 0 ? "—" : gear.classes.join(", "),
    ]);

  return (
    <Table
      columns={[
        { label: "Gear", width: "auto" },
        { label: "Level", width: "auto", align: "right" },
        { label: "Given to", width: "minmax(6rem,1fr)" },
      ]}
      rows={rows()}
      empty="no base gear"
    />
  );
}
