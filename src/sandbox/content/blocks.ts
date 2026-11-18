import { GameResourcesID } from "./resources";
import { COLLIDES, ObjectsID } from "./objects";
import { packTile, type Tile } from "../world/tile";

// 0 = outside the mine: what an empty world array holds before anything is written
export enum BlocksID {
  void = 0,
  air = 1,
  rock = 2,
  bones = 3,
  obsidian = 4,
  gold = 5,
  diamonds = 6,
  silver = 7,
  sapphire = 8,
  copper = 9,
  coal = 10,
  hiddenChest = 11,
}

// variant indices, same order as the block's variants; a rock's variant picks its ramp (RAMPS.rock)
export const ROCK = { brown: 0, gray: 1, darkGray: 2, lightGray: 3, lightBrown: 4 };
export const BONES = { one: 0, two: 1 };

// for tools showing tiles by name; id = the const above, as written in code
export const VARIANT_NAMES: Partial<Record<BlocksID, { id: string; names: Record<string, number> }>> = {
  [BlocksID.rock]: { id: "ROCK", names: ROCK },
  [BlocksID.bones]: { id: "BONES", names: BONES },
};

// rocks-neutral.png: grey tiles, the colour comes from a ramp in tileSolid.wgsl. Rows 0-3 rock
// patterns × columns of features (0 = plain), deposits are overlays drawn over plain rock
export const ROCK_ATLAS = {
  tile: 96,
  patterns: 4,
  features: 8,
  // share of rock tiles without a feature, the rest picks one of the others
  plain: 0.7,
  obsidian: { row: 7, variants: 5, plain: 0.5 },
};

export function atlasCrops(row: number, firstColumn: number, count: number): Crop[] {
  const tile = ROCK_ATLAS.tile;
  return Array.from({ length: count }, (_, index) => ({
    x: (firstColumn + index) * tile,
    y: row * tile,
    width: tile,
    height: tile,
  }));
}

// none: nothing drawn (a hole in the rock); rock / obsidian: the rock atlas through a ramp;
// deposit: plain rock of the rock around + an overlay in its tint, the rock under it (and a bit
// around, the ramps mix) stained: its ramp times stain, linear, 1 = as is; sprite: the old atlas as is
export type BlockLook =
  | { kind: "none" }
  | { kind: "rock" }
  | { kind: "obsidian" }
  | { kind: "deposit"; overlays: Crop[]; tint: RGBA; stain: RGB }
  | { kind: "sprite"; variants: Crop[] };

// srgb; texel brightness → shadow / mid / light (tileSolid.wgsl tileRampColor). Shadows lean to
// violet like the mine's ambient, light to warm like the torches; pattern = row in the rock atlas
export interface Ramp {
  pattern: number;
  shadow: RGBA;
  mid: RGBA;
  light: RGBA;
}

export const RAMPS: { rock: Record<number, Ramp>; obsidian: Ramp } = {
  rock: {
    [ROCK.lightBrown]: { pattern: 0, shadow: [40, 27, 34, 255], mid: [128, 100, 72, 255], light: [204, 170, 120, 255] },
    [ROCK.brown]: { pattern: 0, shadow: [34, 22, 32, 255], mid: [106, 80, 60, 255], light: [174, 138, 98, 255] },
    [ROCK.lightGray]: { pattern: 1, shadow: [30, 28, 42, 255], mid: [110, 104, 98, 255], light: [182, 174, 156, 255] },
    [ROCK.gray]: { pattern: 2, shadow: [24, 24, 40, 255], mid: [84, 88, 98, 255], light: [146, 152, 158, 255] },
    [ROCK.darkGray]: { pattern: 3, shadow: [16, 15, 30, 255], mid: [62, 63, 76, 255], light: [116, 118, 134, 255] },
  },
  obsidian: { pattern: 0, shadow: [8, 4, 18, 255], mid: [46, 30, 72, 255], light: [140, 108, 186, 255] },
};

export interface BlockData {
  look: BlockLook;
  collides: number;
  str: number;
  category: "terrain" | "construct";
  resource?: GameResourcesID;
  // a surprise block: the first hit turns it into air and this object
  reveals?: ObjectsID;
  // no hit ever does anything to it, not even shows it was hit
  unbreakable?: boolean;
  // ore that catches the light: a glint runs over it now and then (TileMask.ore)
  glint?: boolean;
}

export const BLOCKS: Record<BlocksID, BlockData> = {
  [BlocksID.void]: {
    look: { kind: "none" },
    str: 0,
    collides: 0,
    category: "terrain",
    resource: GameResourcesID.none,
  },
  [BlocksID.air]: {
    look: { kind: "none" },
    str: 0,
    collides: 0,
    category: "terrain",
    resource: GameResourcesID.none,
  },
  [BlocksID.rock]: {
    look: { kind: "rock" },
    str: 8,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.stone,
  },
  [BlocksID.bones]: {
    look: { kind: "deposit", overlays: atlasCrops(7, 5, 3), tint: [238, 226, 203, 255], stain: [1.12, 1.04, 0.86] },
    str: 15,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.bones,
  },
  [BlocksID.obsidian]: {
    look: { kind: "obsidian" },
    str: 9999,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.none,
    unbreakable: true,
  },
  [BlocksID.gold]: {
    look: { kind: "deposit", overlays: atlasCrops(4, 3, 3), tint: [236, 186, 84, 255], stain: [1.2, 1.0, 0.62] },
    str: 20,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.gold,
    glint: true,
  },
  [BlocksID.diamonds]: {
    look: { kind: "deposit", overlays: atlasCrops(5, 0, 3), tint: [186, 232, 255, 255], stain: [1.1, 1.22, 1.4] },
    str: 30,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.diamonds,
    glint: true,
  },
  [BlocksID.silver]: {
    look: { kind: "deposit", overlays: atlasCrops(6, 3, 3), tint: [218, 224, 236, 255], stain: [0.92, 0.98, 1.1] },
    str: 12,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.silver,
    glint: true,
  },
  [BlocksID.sapphire]: {
    look: { kind: "deposit", overlays: atlasCrops(5, 3, 3), tint: [104, 140, 255, 255], stain: [0.78, 0.9, 1.4] },
    str: 20,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.sapphire,
    glint: true,
  },
  [BlocksID.copper]: {
    look: { kind: "deposit", overlays: atlasCrops(6, 0, 3), tint: [214, 132, 84, 255], stain: [1.2, 0.82, 0.66] },
    str: 10,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.copper,
  },
  [BlocksID.coal]: {
    look: { kind: "deposit", overlays: atlasCrops(4, 0, 3), tint: [120, 116, 124, 255], stain: [0.5, 0.48, 0.54] },
    str: 6,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.coal,
  },
  [BlocksID.hiddenChest]: {
    look: { kind: "sprite", variants: [{ x: 0, y: 96, width: 96, height: 96 }] },
    str: 0.1,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "construct",
    reveals: ObjectsID.chest,
  },
};

export function getBlock(type: number): BlockData {
  return BLOCKS[type as BlocksID];
}

export function hasGraphics(type: number) {
  return BLOCKS[type as BlocksID].look.kind !== "none";
}

export interface TileName {
  name: string;
  value: Tile;
  // as written in MAP_GEN_CONFIG
  code: string;
}

// every tile the mapGen panel shows and picks by name: plain blocks and named variants
export function tileNames(): TileName[] {
  const names: TileName[] = [];
  for (const [key, id] of Object.entries(BlocksID)) {
    if (typeof id !== "number") continue;
    const variants = VARIANT_NAMES[id as BlocksID];
    if (!variants) {
      names.push({ name: key, value: id, code: `BlocksID.${key}` });
      continue;
    }
    for (const [variant, index] of Object.entries(variants.names))
      names.push({
        name: `${key}.${variant}`,
        value: packTile(id, index),
        code: `packTile(BlocksID.${key}, ${variants.id}.${variant})`,
      });
  }
  return names;
}
