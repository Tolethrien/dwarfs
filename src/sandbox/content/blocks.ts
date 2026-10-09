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

// variant indices, same order as the block's variants
export const ROCK = { brown: 0, gray: 1, darkGray: 2, lightGray: 3, lightBrown: 4 };
export const BONES = { one: 0, two: 1 };

// for tools showing tiles by name; id = the const above, as written in code
export const VARIANT_NAMES: Partial<Record<BlocksID, { id: string; names: Record<string, number> }>> = {
  [BlocksID.rock]: { id: "ROCK", names: ROCK },
  [BlocksID.bones]: { id: "BONES", names: BONES },
};

export interface BlockData {
  // index = variant bits of the tile
  variants: Crop[];
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
    variants: [{ x: 0, y: 0, width: 0, height: 0 }],
    str: 0,
    collides: 0,
    category: "terrain",
    resource: GameResourcesID.none,
  },
  [BlocksID.air]: {
    variants: [{ x: 0, y: 0, width: 0, height: 0 }],
    str: 0,
    collides: 0,
    category: "terrain",
    resource: GameResourcesID.none,
  },
  [BlocksID.rock]: {
    variants: [
      { x: 192, y: 0, width: 96, height: 96 }, // brown
      { x: 288, y: 0, width: 96, height: 96 }, // gray
      { x: 480, y: 0, width: 96, height: 96 }, // darkGray
      { x: 0, y: 96, width: 96, height: 96 }, // lightGray
      { x: 96, y: 96, width: 96, height: 96 }, // lightBrown
    ],
    str: 8,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.stone,
  },
  [BlocksID.bones]: {
    variants: [
      { x: 0, y: 0, width: 96, height: 96 }, // one
      { x: 96, y: 0, width: 96, height: 96 }, // two
    ],
    str: 15,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.bones,
  },
  [BlocksID.obsidian]: {
    variants: [{ x: 384, y: 0, width: 96, height: 96 }],
    str: 9999,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.none,
    unbreakable: true,
  },
  [BlocksID.gold]: {
    variants: [{ x: 192, y: 96, width: 96, height: 96 }],
    str: 20,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.gold,
    glint: true,
  },
  [BlocksID.diamonds]: {
    variants: [{ x: 288, y: 96, width: 96, height: 96 }],
    str: 30,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.diamonds,
    glint: true,
  },
  [BlocksID.silver]: {
    variants: [{ x: 384, y: 96, width: 96, height: 96 }],
    str: 12,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.silver,
    glint: true,
  },
  [BlocksID.sapphire]: {
    variants: [{ x: 480, y: 96, width: 96, height: 96 }],
    str: 20,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.sapphire,
    glint: true,
  },
  [BlocksID.copper]: {
    variants: [{ x: 0, y: 192, width: 96, height: 96 }],
    str: 5,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.copper,
  },
  [BlocksID.coal]: {
    variants: [{ x: 96, y: 192, width: 96, height: 96 }],
    str: 10,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "terrain",
    resource: GameResourcesID.coal,
  },
  [BlocksID.hiddenChest]: {
    variants: [{ x: 0, y: 96, width: 96, height: 96 }],
    str: 0.1,
    collides: COLLIDES.ball | COLLIDES.monster,
    category: "construct",
    reveals: ObjectsID.chest,
  },
};

export function getBlock(type: number): BlockData {
  return BLOCKS[type as BlocksID];
}

// a save can hold a variant the table no longer has
export function getVariantCrop(type: number, variant: number) {
  const variants = BLOCKS[type as BlocksID].variants;
  return variants[variant] ?? variants[0];
}

export function hasGraphics(type: number) {
  return BLOCKS[type as BlocksID].variants[0].width > 0;
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
