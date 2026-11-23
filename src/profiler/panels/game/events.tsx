import Table from "../../blocks/table";
import StatStrip from "../../blocks/statStrip";
import { Block, Rows } from "../../grid/layout";
import { gameStore } from "../../game/store";
import type { GameEventRow } from "@/core/debugger/modules/game/report";

const STATES: GameEventRow["state"][] = ["played", "pending", "waiting"];

function stateText(event: GameEventRow) {
  if (event.state !== "pending" || event.hours === null) return event.state;
  return `in ${event.hours.toFixed(1)} h`;
}

export default function GameEventsPanel() {
  const events = () => gameStore.report().events ?? [];

  return (
    <Rows>
      <Block size="fit">
        <StatStrip
          stats={[
            { label: "Now", value: gameStore.report().date ?? "—" },
            ...STATES.map((state) => ({
              label: state,
              value: String(events().filter((event) => event.state === state).length),
            })),
          ]}
        />
      </Block>
      <Block size="fill">
        <Table
          hug
          columns={[
            { label: "Event" },
            { label: "State" },
            { label: "Requires" },
          ]}
          rows={events().map((event) => [event.name, stateText(event), event.requirement ?? "—"])}
          empty="no story events"
        />
      </Block>
    </Rows>
  );
}
