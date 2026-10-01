import { GameResourcesID } from "./resources";
import type { ColliderBody } from "../components/physics";

// who a tile stops
export const COLLIDES = { ball: 1 << 0, monster: 1 << 1 };

export enum ObjectsID {
  chest = 1,
  palisade = 2,
}

interface ObjectDefinition {
  shape: ColliderBody;
}

export const OBJECTS = {
  [ObjectsID.chest]: {
    shape: { type: "rect", w: 96, h: 96 },
  },
  [ObjectsID.palisade]: {
    shape: { type: "rect", w: 288, h: 32 },
  },
} satisfies Record<ObjectsID, ObjectDefinition>;

export interface LootTable {
  rolls: { min: number; max: number };
  table: { resource: GameResourcesID; weight: number; amount: { min: number; max: number } }[];
}

// placeholder numbers until the loot gets designed
export const LOOT = {
  chest: {
    rolls: { min: 2, max: 4 },
    table: [
      { resource: GameResourcesID.stone, weight: 5, amount: { min: 20, max: 60 } },
      { resource: GameResourcesID.coal, weight: 4, amount: { min: 10, max: 30 } },
      { resource: GameResourcesID.copper, weight: 3, amount: { min: 5, max: 20 } },
      { resource: GameResourcesID.silver, weight: 2, amount: { min: 3, max: 10 } },
      { resource: GameResourcesID.gold, weight: 1, amount: { min: 1, max: 5 } },
      { resource: GameResourcesID.diamonds, weight: 0.3, amount: { min: 1, max: 2 } },
    ],
  },
} satisfies Record<string, LootTable>;
