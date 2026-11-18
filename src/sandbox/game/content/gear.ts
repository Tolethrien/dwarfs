import type Effect from "../effects/effect";
import Add from "../effects/add";

export enum GearSlot {
  helmet,
  gloves,
  tool,
  armor,
}

export const GEAR_SLOT_NAMES: Record<GearSlot, string> = {
  [GearSlot.helmet]: "Helmet",
  [GearSlot.gloves]: "Gloves",
  [GearSlot.tool]: "Tool",
  [GearSlot.armor]: "Armor",
};

// Object.keys gives enum numbers as strings
export const GEAR_SLOTS = Object.keys(GEAR_SLOT_NAMES).map(
  Number,
) as GearSlot[];

export enum BaseGearID {
  deep,
  universal,
  scout,
  mining,
}

// worn by every dwarf that is no foreman, as one piece; levels[0] is level 1, level 0 is locked
export interface BaseGearData {
  name: string;
  description: string;
  levels: Effect[][];
}

function stats(power: number, bph: number, speed: number) {
  const effects: Effect[] = [];
  if (power !== 0) effects.push(new Add("power", power));
  if (bph !== 0) effects.push(new Add("bph", bph));
  if (speed !== 0) effects.push(new Add("speed", speed));
  return effects;
}

export const BASE_GEAR: Record<BaseGearID, BaseGearData> = {
  [BaseGearID.deep]: {
    name: "Deep Gear",
    description:
      "Found by the remains of a proto-dwarf deep in the mine, studied by AGH's finest and copied. It puts force behind every blow, enough to break through the hardest fossils.",
    levels: [stats(5, 0, -2)],
  },
  [BaseGearID.universal]: {
    name: "Universal Gear",
    description: "The standard issue of every dwarf in the mine. Cheap and low quality, it gives the bare minimum.",
    levels: [stats(0.5, -0.25, 0.5), stats(1, -0.5, 1)],
  },
  [BaseGearID.scout]: {
    name: "Scout Gear",
    description: "Gives dwarfs the best footing in the hostile tunnels and caves of the mine.",
    levels: [stats(-1, 0.1, 1), stats(-2, 0.2, 2), stats(-2, 0.3, 3)],
  },
  [BaseGearID.mining]: {
    name: "Mining Gear",
    description: "Tough, heavy kit for the hardest jobs. More strength at the cost of speed.",
    levels: [stats(1, -0.1, -1), stats(2, -0.3, -2), stats(4, -0.3, -2)],
  },
};

export enum Rarity {
  common,
  uncommon,
  rare,
  epic,
  legendary,
}

export const RARITIES: Record<
  Rarity,
  { name: string; letter: string; color: RGBA }
> = {
  [Rarity.common]: { name: "Common", letter: "C", color: [200, 200, 200, 255] },
  [Rarity.uncommon]: {
    name: "Uncommon",
    letter: "U",
    color: [90, 200, 90, 255],
  },
  [Rarity.rare]: { name: "Rare", letter: "R", color: [80, 140, 240, 255] },
  [Rarity.epic]: { name: "Epic", letter: "E", color: [180, 90, 230, 255] },
  [Rarity.legendary]: {
    name: "Legendary",
    letter: "L",
    color: [245, 150, 40, 255],
  },
};

export enum ItemID {}

export interface ItemData {
  name: string;
  description: string;
  slot: GearSlot;
  rarity: Rarity;
  effects: Effect[];
}

export const ITEMS: Record<ItemID, ItemData> = {};
