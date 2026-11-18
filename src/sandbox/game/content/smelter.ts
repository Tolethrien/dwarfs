import { ResourcesID } from "./resources";

export enum RecipeID {
  ironBars,
  concrete,
}

// one batch: takes batch of input and coal, gives yield of output
export interface RecipeData {
  name: string;
  input: ResourcesID;
  batch: number;
  coal: number;
  output: ResourcesID;
  yield: number;
}

export const RECIPES: Record<RecipeID, RecipeData> = {
  [RecipeID.ironBars]: { name: "Iron bars", input: ResourcesID.ironOre, batch: 10, coal: 1, output: ResourcesID.ironBars, yield: 1 },
  [RecipeID.concrete]: { name: "Concrete", input: ResourcesID.stone, batch: 2, coal: 0, output: ResourcesID.concrete, yield: 1 },
};

// Object.keys gives enum numbers as strings
export const RECIPE_IDS = Object.keys(RECIPES).map(Number) as RecipeID[];
