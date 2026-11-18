import Table from "../../blocks/table";
import { Block, Rows } from "../../grid/layout";
import { gameStore } from "../../game/store";

export default function GameResearchPanel() {
  const research = () =>
    (gameStore.report().workforce?.research ?? []).map((trait) => [
      trait.name,
      trait.researched ? "researched" : "not yet",
      trait.description,
    ]);
  const buffs = () =>
    (gameStore.report().buffs ?? []).map((buff) => [
      buff.name,
      buff.secondsLeft === null ? "off" : `${buff.secondsLeft.toFixed(0)} / ${buff.seconds} s`,
      buff.description,
    ]);

  return (
    <Rows>
      <Block size="fill">
        <Table
          columns={[
            { label: "Worker trait", width: "auto" },
            { label: "State", width: "auto" },
            { label: "What it does", width: "minmax(8rem,1fr)" },
          ]}
          rows={research()}
          empty="no worker traits"
        />
      </Block>
      <Block size="fill">
        <Table
          columns={[
            { label: "Buff", width: "auto" },
            { label: "Time left", width: "auto", align: "right" },
            { label: "What it does", width: "minmax(8rem,1fr)" },
          ]}
          rows={buffs()}
          empty="no buffs"
        />
      </Block>
    </Rows>
  );
}
