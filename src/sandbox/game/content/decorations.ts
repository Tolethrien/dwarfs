import DECO_SHEET from "@sandbox/assets/deco/deco.json";
import { LightsID } from "./lights";

export enum DecosID {
  barrel,
  crate,
  stalactites,
  stalagmiteTall,
  stalagmiteWide,
  roots,
  mossStrip,
  vinesBuds,
  quartzCluster,
  cobweb,
  mushroomsAmber,
  mushroomsCyan,
  mushroomsViolet,
  mushroomsEmerald,
  mushroomsCrimson,
  mushroomsBone,
  shelfMushroomsBrown,
  shelfMushroomsBlue,
  shelfMushroomsRust,
  rubble,
}

export type DecoAttach = "floor" | "ceiling" | "wall" | "corner" | "none";
export type DecoLayer = "back" | "front";
export type DecoSupport = "floor" | "ceiling" | "left" | "right" | "topLeft" | "topRight" | "none";

export interface DecoData {
  crop: Crop;
  anchor: Position2D;
  attach: DecoAttach;
  light?: LightsID;
  frontChance: number;
}

const FRAMES = DECO_SHEET.frames;

export const DECORATIONS: Record<DecosID, DecoData> = {
  [DecosID.barrel]: {
    crop: FRAMES.barrel.crop,
    anchor: FRAMES.barrel.anchor,
    attach: "floor",
    frontChance: 0,
  },
  [DecosID.crate]: {
    crop: FRAMES.crate.crop,
    anchor: FRAMES.crate.anchor,
    attach: "floor",
    frontChance: 0,
  },
  [DecosID.stalactites]: {
    crop: FRAMES.stalactites.crop,
    anchor: FRAMES.stalactites.anchor,
    attach: "ceiling",
    frontChance: 0.3,
  },
  [DecosID.stalagmiteTall]: {
    crop: FRAMES.stalagmiteTall.crop,
    anchor: FRAMES.stalagmiteTall.anchor,
    attach: "floor",
    frontChance: 0.25,
  },
  [DecosID.stalagmiteWide]: {
    crop: FRAMES.stalagmiteWide.crop,
    anchor: FRAMES.stalagmiteWide.anchor,
    attach: "floor",
    frontChance: 0.25,
  },
  [DecosID.roots]: {
    crop: FRAMES.roots.crop,
    anchor: FRAMES.roots.anchor,
    attach: "ceiling",
    frontChance: 0.45,
  },
  [DecosID.mossStrip]: {
    crop: FRAMES.mossStrip.crop,
    anchor: FRAMES.mossStrip.anchor,
    attach: "ceiling",
    frontChance: 0.4,
  },
  [DecosID.vinesBuds]: {
    crop: FRAMES.vinesBuds.crop,
    anchor: FRAMES.vinesBuds.anchor,
    attach: "ceiling",
    frontChance: 0.5,
  },
  [DecosID.quartzCluster]: {
    crop: FRAMES.quartzCluster.crop,
    anchor: FRAMES.quartzCluster.anchor,
    attach: "floor",
    frontChance: 0.2,
  },
  [DecosID.cobweb]: {
    crop: FRAMES.cobweb.crop,
    anchor: FRAMES.cobweb.anchor,
    attach: "corner",
    frontChance: 0.55,
  },
  [DecosID.mushroomsAmber]: {
    crop: FRAMES.mushroomsAmber.crop,
    anchor: FRAMES.mushroomsAmber.anchor,
    attach: "floor",
    light: LightsID.mushroomAmber,
    frontChance: 0.35,
  },
  [DecosID.mushroomsCyan]: {
    crop: FRAMES.mushroomsCyan.crop,
    anchor: FRAMES.mushroomsCyan.anchor,
    attach: "floor",
    light: LightsID.mushroomCyan,
    frontChance: 0.35,
  },
  [DecosID.mushroomsViolet]: {
    crop: FRAMES.mushroomsViolet.crop,
    anchor: FRAMES.mushroomsViolet.anchor,
    attach: "floor",
    light: LightsID.mushroomViolet,
    frontChance: 0.35,
  },
  [DecosID.mushroomsEmerald]: {
    crop: FRAMES.mushroomsEmerald.crop,
    anchor: FRAMES.mushroomsEmerald.anchor,
    attach: "floor",
    light: LightsID.mushroomEmerald,
    frontChance: 0.35,
  },
  [DecosID.mushroomsCrimson]: {
    crop: FRAMES.mushroomsCrimson.crop,
    anchor: FRAMES.mushroomsCrimson.anchor,
    attach: "floor",
    light: LightsID.mushroomCrimson,
    frontChance: 0.35,
  },
  [DecosID.mushroomsBone]: {
    crop: FRAMES.mushroomsBone.crop,
    anchor: FRAMES.mushroomsBone.anchor,
    attach: "floor",
    light: LightsID.mushroomBone,
    frontChance: 0.35,
  },
  [DecosID.shelfMushroomsBrown]: {
    crop: FRAMES.shelfMushroomsBrown.crop,
    anchor: FRAMES.shelfMushroomsBrown.anchor,
    attach: "wall",
    light: LightsID.shelfMushroomBrown,
    frontChance: 0.3,
  },
  [DecosID.shelfMushroomsBlue]: {
    crop: FRAMES.shelfMushroomsBlue.crop,
    anchor: FRAMES.shelfMushroomsBlue.anchor,
    attach: "wall",
    light: LightsID.shelfMushroomBlue,
    frontChance: 0.3,
  },
  [DecosID.shelfMushroomsRust]: {
    crop: FRAMES.shelfMushroomsRust.crop,
    anchor: FRAMES.shelfMushroomsRust.anchor,
    attach: "wall",
    light: LightsID.shelfMushroomRust,
    frontChance: 0.3,
  },
  [DecosID.rubble]: {
    crop: FRAMES.rubble.crop,
    anchor: FRAMES.rubble.anchor,
    attach: "floor",
    frontChance: 0.4,
  },
};
