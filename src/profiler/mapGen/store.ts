import { createSignal } from "solid-js";
import type { MapGenReport } from "@/core/debugger/modules/mapGen/report";

const [report, setReport] = createSignal<MapGenReport | null>(null);

window.API.DEBUG.onMapGen((next) => setReport(next));
window.API.DEBUG.onGameReloaded(() => setReport(null));

export const mapGenStore = {
  report,
  live: () => report() !== null,
};
