import type { BuildTool } from "../build/build";
import {
  buildingTool,
  jointTool,
  railTool,
  shaftSegmentTool,
  stationTool,
  structureTool,
} from "../build/blueprints";
import type { BuildLayer } from "../build/space";
import type Condition from "../conditions/condition";
import { hasPlan } from "../conditions/hasPlan";
import { hqLevel } from "../conditions/hqLevel";
import { ResourcesID, type ResourceCost } from "./resources";
import { BuildingsID, STRUCTURES } from "./structures";

export type { BuildLayer } from "../build/space";

export enum BuildCategoryID {
  shafts,
  buildings,
  transport,
  other,
}

export interface BuildCategoryData {
  title: string;
  short: string;
  layer: BuildLayer;
  requires?: Condition;
}

export const BUILD_CATEGORIES: Record<BuildCategoryID, BuildCategoryData> = {
  [BuildCategoryID.shafts]: { title: "Shafts", short: "Sh", layer: "main" },
  [BuildCategoryID.buildings]: { title: "Buildings", short: "Bu", layer: "main" },
  [BuildCategoryID.transport]: {
    title: "Transport",
    short: "Tr",
    layer: "main",
    requires: hasPlan("railway", "Research Railway in AGH"),
  },
  [BuildCategoryID.other]: { title: "Other", short: "Ot", layer: "main" },
};

export enum BuildElementID {
  shaft20,
  shaft30,
  tavern,
  brewery,
  smelter,
  station,
  rail,
  shaftJoint,
  palisade,
  metalPalisade,
}

export interface BuildElementData {
  category: BuildCategoryID;
  title: string;
  short: string;
  cost: ResourceCost;
  requires?: Condition;
  tool: BuildTool;
}

const COSTS = {
  shaft20: { [ResourcesID.stone]: 200, [ResourcesID.beer]: 50 } as ResourceCost,
  shaft30: { [ResourcesID.stone]: 350, [ResourcesID.beer]: 80 } as ResourceCost,
  tavern: { [ResourcesID.stone]: 50, [ResourcesID.beer]: 100 } as ResourceCost,
  brewery: { [ResourcesID.stone]: 50, [ResourcesID.beer]: 100 } as ResourceCost,
  smelter: { [ResourcesID.stone]: 50, [ResourcesID.beer]: 100 } as ResourceCost,
  station: { [ResourcesID.stone]: 150, [ResourcesID.beer]: 30 } as ResourceCost,
  rail: { [ResourcesID.stone]: 5 } as ResourceCost,
  shaftJoint: { [ResourcesID.stone]: 20 } as ResourceCost,
  palisade: { [ResourcesID.ironOre]: 20, [ResourcesID.wood]: 10 } as ResourceCost,
  metalPalisade: { [ResourcesID.ironBars]: 15, [ResourcesID.stone]: 10 } as ResourceCost,
};

export const BUILD_ELEMENTS: Record<BuildElementID, BuildElementData> = {
  [BuildElementID.shaft20]: {
    category: BuildCategoryID.shafts,
    title: "Shaft, 20 tiles deeper",
    short: "20",
    cost: COSTS.shaft20,
    requires: hqLevel(2),
    tool: shaftSegmentTool(20, "Shaft, 20 tiles deeper", COSTS.shaft20),
  },
  [BuildElementID.shaft30]: {
    category: BuildCategoryID.shafts,
    title: "Shaft, 30 tiles deeper",
    short: "30",
    cost: COSTS.shaft30,
    requires: hqLevel(2),
    tool: shaftSegmentTool(30, "Shaft, 30 tiles deeper", COSTS.shaft30),
  },
  [BuildElementID.tavern]: {
    category: BuildCategoryID.buildings,
    title: "Tavern",
    short: "Ta",
    cost: COSTS.tavern,
    requires: hqLevel(1),
    tool: buildingTool(BuildingsID.tavern, "Tavern", COSTS.tavern),
  },
  [BuildElementID.brewery]: {
    category: BuildCategoryID.buildings,
    title: "Brewery",
    short: "Br",
    cost: COSTS.brewery,
    requires: hqLevel(2),
    tool: buildingTool(BuildingsID.brewery, "Brewery", COSTS.brewery),
  },
  [BuildElementID.smelter]: {
    category: BuildCategoryID.buildings,
    title: "Smelter",
    short: "Sm",
    cost: COSTS.smelter,
    requires: hqLevel(1),
    tool: buildingTool(BuildingsID.smelter, "Smelter", COSTS.smelter),
  },
  [BuildElementID.station]: {
    category: BuildCategoryID.transport,
    title: "Station",
    short: "St",
    cost: COSTS.station,
    requires: hasPlan("railway", "Research Railway in AGH"),
    tool: stationTool("Station", COSTS.station),
  },
  [BuildElementID.rail]: {
    category: BuildCategoryID.transport,
    title: "Rail, a tile",
    short: "Ra",
    cost: COSTS.rail,
    requires: hasPlan("railway", "Research Railway in AGH"),
    tool: railTool(COSTS.rail),
  },
  [BuildElementID.shaftJoint]: {
    category: BuildCategoryID.transport,
    title: "Shaft joint",
    short: "Jo",
    cost: COSTS.shaftJoint,
    requires: hasPlan("railway", "Research Railway in AGH"),
    tool: jointTool("Shaft joint", COSTS.shaftJoint),
  },
  [BuildElementID.palisade]: {
    category: BuildCategoryID.other,
    title: "Palisade",
    short: "Pa",
    cost: COSTS.palisade,
    requires: hasPlan("palisade", "Needs palisade plans from the Party"),
    tool: structureTool({
      name: "Palisade",
      cost: COSTS.palisade,
      size: STRUCTURES.palisade.size,
      rotatable: true,
      solid: true,
      hp: STRUCTURES.palisade.hp,
      look: STRUCTURES.palisade.look,
    }),
  },
  [BuildElementID.metalPalisade]: {
    category: BuildCategoryID.other,
    title: "Metal palisade",
    short: "MP",
    cost: COSTS.metalPalisade,
    requires: hasPlan("metalPalisade", "Research Reinforced Palisade in AGH"),
    tool: structureTool({
      name: "Metal palisade",
      cost: COSTS.metalPalisade,
      size: STRUCTURES.metalPalisade.size,
      rotatable: true,
      solid: true,
      hp: STRUCTURES.metalPalisade.hp,
      look: STRUCTURES.metalPalisade.look,
    }),
  },
};

// Object.keys gives enum numbers as strings
export function categoriesOf(layer: BuildLayer) {
  const ids = Object.keys(BUILD_CATEGORIES).map(Number) as BuildCategoryID[];
  return ids.filter((id) => BUILD_CATEGORIES[id].layer === layer);
}

export function elementsOf(category: BuildCategoryID) {
  const ids = Object.keys(BUILD_ELEMENTS).map(Number) as BuildElementID[];
  return ids.filter((id) => BUILD_ELEMENTS[id].category === category);
}
