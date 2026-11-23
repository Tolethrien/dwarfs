import StatStrip from "../../blocks/statStrip";
import { gameStore } from "../../game/store";

export default function GameStoredPanel() {
  return (
    <StatStrip
      stats={(gameStore.report().resources ?? []).map((resource) => ({
        label: resource.name,
        value: resource.amount,
      }))}
    />
  );
}
