import { BASE_GEAR, BaseGearID } from "./gear";
import type PlayerStats from "../systems/core/playerStats";
import type Workforce from "../systems/dwarfs/workforce";

export enum AghCategoryID {
  roster,
  transport,
  buildings,
}

export interface AghCategoryData {
  title: string;
}

export const AGH_CATEGORIES: Record<AghCategoryID, AghCategoryData> = {
  [AghCategoryID.roster]: { title: "Roster" },
  [AghCategoryID.transport]: { title: "Transport" },
  [AghCategoryID.buildings]: { title: "Buildings" },
};

// Object.keys gives enum numbers as strings
export const AGH_CATEGORY_IDS = Object.keys(AGH_CATEGORIES).map(Number) as AghCategoryID[];

export enum AghUpgradeID {
  miningGear,
  pyro,
  railway,
  metalPalisade,
}

export interface AghContext {
  playerStats: PlayerStats;
  workforce: Workforce;
}

export interface AghUpgradeLevel {
  title: string;
  description: string;
  apply: (ctx: AghContext) => void;
}

export interface AghUpgradeData {
  category: AghCategoryID;
  levels: AghUpgradeLevel[];
}

function gearLevel(gear: BaseGearID, level: number, title: string): AghUpgradeLevel {
  const stats = BASE_GEAR[gear].levels[level - 1].map((effect) => effect.describe()).join(", ");
  return {
    title: title,
    description: `${BASE_GEAR[gear].name} Lv.${level} (${stats})`,
    apply: (ctx) => {
      ctx.workforce.setLevel(gear, level);
      ctx.workforce.touch();
    },
  };
}

export const AGH_UPGRADES: Record<AghUpgradeID, AghUpgradeData> = {
  [AghUpgradeID.miningGear]: {
    category: AghCategoryID.roster,
    levels: [
      gearLevel(BaseGearID.mining, 1, "Mining Gear I"),
      gearLevel(BaseGearID.mining, 2, "Mining Gear II"),
      gearLevel(BaseGearID.mining, 3, "Mining Gear III"),
    ],
  },
  [AghUpgradeID.pyro]: {
    category: AghCategoryID.roster,
    levels: [
      {
        title: "Pyro",
        description: "Pyros start showing up among the tavern's applications.",
        apply: (ctx) => {
          ctx.playerStats.unlock("pyro");
          ctx.workforce.touch();
        },
      },
    ],
  },
  [AghUpgradeID.railway]: {
    category: AghCategoryID.transport,
    levels: [
      {
        title: "Railway",
        description: "Unlocks the Transport build category with stations, rails and shaft joints.",
        apply: (ctx) => ctx.playerStats.unlock("railway"),
      },
    ],
  },
  [AghUpgradeID.metalPalisade]: {
    category: AghCategoryID.buildings,
    levels: [
      {
        title: "Reinforced Palisade",
        description: "Unlocks the metal palisade (length 6, withstands 50 hits).",
        apply: (ctx) => ctx.playerStats.unlock("metalPalisade"),
      },
    ],
  },
};

// Object.keys gives enum numbers as strings
export const AGH_UPGRADE_IDS = Object.keys(AGH_UPGRADES).map(Number) as AghUpgradeID[];

export function upgradesIn(category: AghCategoryID) {
  return AGH_UPGRADE_IDS.filter((id) => AGH_UPGRADES[id].category === category);
}
