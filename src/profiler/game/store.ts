import { createSignal } from "solid-js";
import type { GameReport } from "@/core/debugger/modules/game/report";

const [report, setReport] = createSignal<Partial<GameReport>>({});
const [received, setReceived] = createSignal(false);

window.API.DEBUG.onGame((next) => {
  setReport(next);
  setReceived(true);
});
window.API.DEBUG.onGameReloaded(() => {
  setReport({});
  setReceived(false);
});

export const gameStore = {
  report,
  live: received,
};
