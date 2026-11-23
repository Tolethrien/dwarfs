import { always } from "../drops/always";
import type { ResourceDrop } from "../drops/resources";
import { ResourcesID, type ResourceCost } from "./resources";

export enum RecipeID {
  ironBars,
  concrete,
}

// one batch: takes input, runs for hours of game time, rolls output
export interface RecipeData {
  name: string;
  input: ResourceCost;
  hours: number;
  output: ResourceDrop;
}

export const RECIPES: Record<RecipeID, RecipeData> = {
  [RecipeID.ironBars]: {
    name: "Iron bars",
    input: { [ResourcesID.ironOre]: 4 },
    hours: 0.1,
    output: always(ResourcesID.ironBars, 1),
  },
  [RecipeID.concrete]: {
    name: "Concrete",
    input: { [ResourcesID.stone]: 2 },
    hours: 0.05,
    output: always(ResourcesID.concrete, 1),
  },
};

export function recipeCost(id: RecipeID, batches = 1): ResourceCost {
  const cost: ResourceCost = {};
  for (const [resource, amount] of Object.entries(RECIPES[id].input)) {
    if (amount) cost[Number(resource) as ResourcesID] = amount * batches;
  }
  return cost;
}

// Object.keys gives enum numbers as strings
export const RECIPE_IDS = Object.keys(RECIPES).map(Number) as RecipeID[];
