import { createComponent, type Component } from "solid-js";
import { auroraStore } from "../aurora/store";
import AuroraFramePanel from "./aurora/frame";
import AuroraGpuTimingsPanel from "./aurora/gpuTimings";
import AuroraTimelinePanel from "./aurora/timeline";
import AuroraDrawPanel from "./aurora/draw";
import AuroraVramPanel from "./aurora/vram";
import AuroraResourcesPanel from "./aurora/resources";
import AuroraConfigPanel from "./aurora/config";
import AuroraPresetPanel from "./aurora/preset";
import { gameStore } from "../game/store";
import GameDwarfsPanel from "./game/dwarfs";
import GameWorkforcePanel from "./game/workforce";
import GameBuffsPanel from "./game/buffs";
import GameNetworkPanel from "./game/network";
import GameCampPanel from "./game/camp";
import GameStoredPanel from "./game/stored";
import GameMarketPanel from "./game/market";
import GameSmelterPanel from "./game/smelter";
import GameCostsPanel from "./game/costs";
import GamePlayerPanel from "./game/player";
import GameEventsPanel from "./game/events";
import WatchPanel from "./watch/watch";
import { watchStore } from "../watch/store";
import { coroutineStore } from "../coroutines/store";
import CoroutinesRunningPanel from "./coroutines/running";
import CoroutinesFinishedPanel from "./coroutines/finished";

export interface PanelDefinition {
  title: string | (() => string);
  // w in grid columns, h in grid rows
  size: { w: number; h: number };
  // the panel shrinks to its content, size and share are the most it takes
  fit?: boolean;
  // part of the grid width (0.5 = half) instead of size.w, never narrower than size.w
  share?: number;
  component: Component;
  live?: () => boolean;
}

export const PANELS = {
  auroraFrame: {
    title: "GPU frame",
    size: { w: 8, h: 6 },
    component: AuroraFramePanel,
    live: auroraStore.live,
  },
  auroraGpuTimings: {
    title: "GPU timings",
    size: { w: 10, h: 9 },
    component: AuroraGpuTimingsPanel,
    live: auroraStore.live,
  },
  auroraTimeline: {
    title: "GPU timeline",
    size: { w: 16, h: 9 },
    component: AuroraTimelinePanel,
    live: auroraStore.live,
  },
  auroraDraw: {
    title: "Draw",
    size: { w: 12, h: 12 },
    component: AuroraDrawPanel,
    live: auroraStore.live,
  },
  auroraVram: {
    title: "VRAM",
    size: { w: 8, h: 9 },
    component: AuroraVramPanel,
    live: auroraStore.live,
  },
  auroraResources: {
    title: "Resources",
    size: { w: 16, h: 12 },
    component: AuroraResourcesPanel,
    live: auroraStore.live,
  },
  auroraConfig: {
    title: "Aurora Config",
    size: { w: 16, h: 12 },
    component: AuroraConfigPanel,
    live: auroraStore.live,
  },
  auroraPreset: {
    title: "Preset Config",
    size: { w: 6, h: 6 },
    component: AuroraPresetPanel,
    live: auroraStore.live,
  },
  gameDwarfs: {
    title: "Dwarfs",
    size: { w: 24, h: 15 },
    share: 1,
    component: GameDwarfsPanel,
    fit: true,
    live: gameStore.live,
  },
  gameNetwork: {
    title: "Network",
    size: { w: 8, h: 15 },
    share: 0.5,
    component: GameNetworkPanel,
    fit: true,
    live: gameStore.live,
  },
  gameCamp: {
    title: "Camp",
    size: { w: 8, h: 12 },
    share: 0.5,
    component: GameCampPanel,
    fit: true,
    live: gameStore.live,
  },
  gameStored: {
    title: "Stored",
    size: { w: 6, h: 9 },
    share: 0.5,
    component: GameStoredPanel,
    fit: true,
    live: gameStore.live,
  },
  gameEvents: {
    title: "Events",
    size: { w: 8, h: 12 },
    share: 0.5,
    component: GameEventsPanel,
    fit: true,
    live: gameStore.live,
  },
  gameMarket: {
    title: "Market",
    size: { w: 6, h: 12 },
    share: 0.5,
    component: GameMarketPanel,
    fit: true,
    live: gameStore.live,
  },
  gameSmelter: {
    title: "Smelter",
    size: { w: 8, h: 9 },
    share: 0.5,
    component: GameSmelterPanel,
    fit: true,
    live: gameStore.live,
  },
  gameCosts: {
    title: "Costs",
    size: { w: 6, h: 15 },
    share: 0.5,
    component: GameCostsPanel,
    fit: true,
    live: gameStore.live,
  },
  gameWorkforce: {
    title: "Workforce",
    size: { w: 6, h: 12 },
    share: 0.5,
    component: GameWorkforcePanel,
    fit: true,
    live: gameStore.live,
  },
  gameBuffs: {
    title: "Buffs",
    size: { w: 6, h: 12 },
    share: 0.5,
    component: GameBuffsPanel,
    fit: true,
    live: gameStore.live,
  },
  gamePlayer: {
    title: "Player",
    size: { w: 6, h: 12 },
    share: 0.5,
    component: GamePlayerPanel,
    fit: true,
    live: gameStore.live,
  },
  coroutinesRunning: {
    title: "Coroutines",
    size: { w: 24, h: 15 },
    component: CoroutinesRunningPanel,
    live: coroutineStore.live,
  },
  coroutinesFinished: {
    title: "Finished coroutines",
    size: { w: 24, h: 9 },
    component: CoroutinesFinishedPanel,
    live: coroutineStore.live,
  },
} satisfies Record<string, PanelDefinition>;

export const panelTitle = (definition: PanelDefinition) =>
  typeof definition.title === "function"
    ? definition.title()
    : definition.title;

export const panelColumns = (definition: PanelDefinition, columns: number) =>
  definition.share === undefined
    ? definition.size.w
    : Math.max(definition.size.w, Math.floor(columns * definition.share));

type StaticPanelId = keyof typeof PANELS;
export type PanelId = StaticPanelId | `watch:${string}`;

const WATCH_PANEL = {
  prefix: "watch:" as const,
  defaultSize: { w: 6, h: 9 },
};

// created lazily and kept, so a panel keeps the same definition across re-renders
const watchDefinitions = new Map<string, PanelDefinition>();

export const watchPanelId = (name: string): PanelId =>
  `${WATCH_PANEL.prefix}${name}`;

export const isPanelId = (id: string): id is PanelId =>
  id in PANELS || id.startsWith(WATCH_PANEL.prefix);

export function panelDefinition(id: PanelId): PanelDefinition {
  if (id in PANELS) return PANELS[id as StaticPanelId];
  const name = id.slice(WATCH_PANEL.prefix.length);
  let definition = watchDefinitions.get(name);
  if (!definition) {
    definition = {
      title: () => {
        const info = watchStore.info(name);
        return info ? `${info.scope} · ${name}` : name;
      },
      get size() {
        return watchStore.info(name)?.size ?? WATCH_PANEL.defaultSize;
      },
      component: () => createComponent(WatchPanel, { name }),
      live: () => watchStore.has(name),
    };
    watchDefinitions.set(name, definition);
  }
  return definition;
}
