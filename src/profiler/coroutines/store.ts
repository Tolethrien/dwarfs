import { createSignal } from "solid-js";
import type { CoroutineReport } from "@/core/debugger/modules/coroutines/report";

const [report, setReport] = createSignal<CoroutineReport | null>(null);
// the game keeps sending its last finished ones, a clear hides the ids it saw
const [cleared, setCleared] = createSignal<ReadonlySet<number>>(new Set());

window.API.DEBUG.onCoroutines((next) => setReport(next));
window.API.DEBUG.onGameReloaded(() => {
  setReport(null);
  setCleared(new Set<number>());
});

function finished() {
  return (report()?.finished ?? []).filter((node) => !cleared().has(node.id));
}

export const coroutineStore = {
  report,
  finished,
  clearFinished: () => setCleared(new Set((report()?.finished ?? []).map((node) => node.id))),
  live: () => report() !== null,
};
