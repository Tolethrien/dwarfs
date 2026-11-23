import ROCK_SHEET from "@sandbox/assets/rocks/rocks-spritesheet.json";
import { always } from "../drops/always";
import type { ResourceDrop } from "../drops/resources";
import { ResourcesID } from "./resources";

// every kind of tile on the map; void and air first, so an empty world array is "nothing"
export enum BlocksID {
  void,
  air,
  dirt,
  stone,
  coal,
  iron,
  fossils,
  obsidian,
  structure,
  rail,
  building,
  sandstone,
  granite,
  slate,
  gneiss,
  marble,
  ice,
  moss,
}

type SheetBlock = keyof typeof ROCK_SHEET.blocks;

export interface BlockData {
  solid: boolean;
  drops?: ResourceDrop;
  seeThrough?: boolean;
  noMist?: boolean;
  // the mist goes through it as through open space (a camp building, its sprite masks the mist)
  mistFlows?: boolean;
  str: number;
  sheet?: SheetBlock;
  ownColors?: boolean;
  glow?: {
    color: RGB;
    blend: number;
    shine: number;
    style?: GlowStyle;
    sparkle?: { density: number; speed: number };
  };
}

// glow: the ore lit through on its own; glint: dark and glassy, only cold flashes on its grains
// (anthracite); embers: a dim red smoulder in its dark cracks; sheen: a dull metal, a band of light
// sliding over the vein now and then; the order is the shader's (tileMap.wgsl)
export const GLOW_STYLES = ["glow", "glint", "embers", "sheen"] as const;
export type GlowStyle = (typeof GLOW_STYLES)[number];

export const BLOCKS: Record<BlocksID, BlockData> = {
  [BlocksID.void]: { solid: true, str: Infinity },
  [BlocksID.air]: { solid: false, str: 0 },
  [BlocksID.dirt]: { solid: true, str: 3, sheet: "dirt" },
  [BlocksID.stone]: {
    solid: true,
    drops: always(ResourcesID.stone, 0.5),
    str: 6,
    sheet: "stone",
  },
  [BlocksID.coal]: {
    solid: true,
    drops: always(ResourcesID.coal, 1),
    str: 6.5,
    sheet: "coal",
    ownColors: true,
    glow: { color: [235, 115, 20], blend: 1, shine: 5 },
  },
  [BlocksID.iron]: {
    solid: true,
    drops: always(ResourcesID.ironOre, 1),
    str: 7.2,
    sheet: "iron",
    ownColors: true,
    glow: {
      color: [128, 180, 194],
      blend: 0.85,
      shine: 4.5,
      sparkle: { density: 0, speed: 0 },
    },
  },
  [BlocksID.fossils]: {
    solid: true,
    drops: always(ResourcesID.boneMeal, 0.1),
    str: 6,
    sheet: "fossils",
    ownColors: true,
    glow: {
      color: [235, 225, 200],
      blend: 0.5,
      shine: 1,
      style: "sheen",
      sparkle: { density: 0, speed: 0 },
    },
  },
  [BlocksID.obsidian]: {
    solid: true,
    str: Infinity,
    sheet: "obsidian",
    glow: { color: [200, 180, 255], blend: 0.6, shine: 1.5, style: "glint" },
  },
  [BlocksID.structure]: {
    solid: true,
    seeThrough: true,
    noMist: true,
    str: Infinity,
  },
  [BlocksID.rail]: { solid: false, str: Infinity },
  [BlocksID.building]: {
    solid: true,
    seeThrough: true,
    mistFlows: true,
    str: Infinity,
  },
  [BlocksID.sandstone]: {
    solid: true,
    drops: always(ResourcesID.stone, 0.5),
    str: 4.5,
    sheet: "sandstone",
  },
  [BlocksID.granite]: {
    solid: true,
    drops: always(ResourcesID.stone, 0.5),
    str: 9,
    sheet: "granite",
  },
  [BlocksID.slate]: {
    solid: true,
    drops: always(ResourcesID.stone, 0.5),
    str: 5.5,
    sheet: "slate",
  },
  [BlocksID.gneiss]: {
    solid: true,
    drops: always(ResourcesID.stone, 0.5),
    str: 11,
    sheet: "gneiss",
  },
  [BlocksID.marble]: {
    solid: true,
    drops: always(ResourcesID.stone, 0.5),
    str: 7.5,
    sheet: "marble",
  },
  [BlocksID.ice]: { solid: true, str: 4, sheet: "ice" },
  [BlocksID.moss]: { solid: true, str: 2, sheet: "moss" },
};

export function blocksSight(type: BlocksID) {
  const block = BLOCKS[type];
  return block.solid && block.seeThrough !== true;
}

export function isNatural(type: BlocksID) {
  return BLOCKS[type].sheet !== undefined;
}

export const BLOCK_LOOKS = ROCK_SHEET.variants;

export const BLOCK_CROPS: Partial<Record<BlocksID, Crop[]>> = {};
for (const [id, block] of Object.entries(BLOCKS)) {
  if (block.sheet === undefined) continue;
  const first = ROCK_SHEET.blocks[block.sheet];
  const tile = ROCK_SHEET.tileSize;
  const crops: Crop[] = [];
  for (let look = 0; look < BLOCK_LOOKS; look++)
    crops.push({
      x: (first.x + look) * tile,
      y: first.y * tile,
      width: tile,
      height: tile,
    });
  BLOCK_CROPS[Number(id) as BlocksID] = crops;
}
