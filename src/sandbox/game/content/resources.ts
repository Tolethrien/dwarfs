import RESOURCE_SHEET from "@sandbox/assets/icons/resources.json";

export enum ResourcesID {
  beer,
  stone,
  ironOre,
  coal,
  boneMeal,
  ironBars,
  concrete,
}

export enum ResourceCategory {
  materials,
  raw,
}

export const RESOURCE_CATEGORIES: Record<ResourceCategory, string> = {
  [ResourceCategory.materials]: "Materials",
  [ResourceCategory.raw]: "Raw",
};

// the resources HUD shows 1: beer alone, 2: the materials too, 3: the raw ones as well
export type ResourceView = 1 | 2 | 3;

export type ResourceCost = Partial<Record<ResourcesID, number>>;

export interface ResourceData {
  name: string;
  unit: string;
  icon: Crop;
  category?: ResourceCategory;
  viewFrom: ResourceView;
}

export const RESOURCES: Record<ResourcesID, ResourceData> = {
  [ResourcesID.beer]: { name: "Beer", unit: "L", icon: RESOURCE_SHEET.frames.beer.crop, viewFrom: 1 },
  [ResourcesID.stone]: { name: "Stone", unit: "kg", icon: RESOURCE_SHEET.frames.stone.crop, category: ResourceCategory.raw, viewFrom: 3 },
  [ResourcesID.ironOre]: { name: "Iron ore", unit: "kg", icon: RESOURCE_SHEET.frames.iron.crop, category: ResourceCategory.raw, viewFrom: 3 },
  [ResourcesID.coal]: { name: "Coal", unit: "kg", icon: RESOURCE_SHEET.frames.coal.crop, category: ResourceCategory.materials, viewFrom: 2 },
  [ResourcesID.boneMeal]: { name: "Bone meal", unit: "kg", icon: RESOURCE_SHEET.frames.bones.crop, category: ResourceCategory.materials, viewFrom: 2 },
  [ResourcesID.ironBars]: { name: "Iron bars", unit: "kg", icon: RESOURCE_SHEET.frames.iron.crop, category: ResourceCategory.materials, viewFrom: 2 },
  [ResourcesID.concrete]: { name: "Concrete", unit: "kg", icon: RESOURCE_SHEET.frames.stone.crop, category: ResourceCategory.materials, viewFrom: 2 },
};

// Object.keys gives enum numbers as strings
export const RESOURCE_IDS = Object.keys(RESOURCES).map(Number) as ResourcesID[];

// one decimal at most, none for a whole amount: 100 L, 21.6 L
export function formatAmount(id: ResourcesID, amount: number) {
  return `${Math.round(amount * 10) / 10} ${RESOURCES[id].unit}`;
}
