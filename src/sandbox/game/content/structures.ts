import BUILDING_SHEET from "@sandbox/assets/structures/camp-buildings-spritesheet.json";
import { LightsID } from "./lights";
import { ResourcesID, type ResourceCost } from "./resources";

export const STRUCTURES = {
  plan: { line: 0.08 },
  buildings: {
    maxDepth: 100,
  },
  station: {
    crater: { radius: 9, built: 4, jag: 0.2, bumps: 1.5, fade: 3 },
    look: {
      body: { width: 4, height: 2, color: [70, 74, 86, 255] as RGBA },
      deck: { width: 5, height: 0.4, color: [118, 76, 40, 255] as RGBA },
      text: { size: 0.4, gap: 0.2, color: [255, 235, 200, 255] as RGBA },
      light: LightsID.buildingLamp,
    },
  },
  rails: {
    durability: 100,
    look: { width: 0.25, color: [150, 150, 160, 255] as RGBA, broken: [120, 45, 40, 255] as RGBA },
  },
  shaft: {
    width: 20,
    startDepth: 60,
    jag: 1,
    frequency: 0.2,
    look: {
      // drawn one under another down to the bottom, halves of them side by side across the shaft
      segment: BUILDING_SHEET.frames.shaftSegment.crop,
      halves: 2,
      post: { width: 1 },
      // spread evenly over the halves, each half's between its posts
      lanes: { count: 4 },
      lamps: { from: 5, every: 10, light: LightsID.shaftLamp, radius: 0.2, color: [255, 200, 120, 255] as RGBA },
      // a warm glow down the whole shaft, its sides fading into the rock (softness in tiles)
      glow: { color: [255, 175, 100, 255] as RGBA, intensity: 0.35, softness: 4 },
    },
  },
};

export enum BuildingsID {
  tavern,
  market,
  brewery,
  smelter,
}

export interface BuildingData {
  name: string;
  size: Size2D;
  reserve: { away: number; up: number; down: number };
  sprite: Crop;
  // where a dwarf stands in the doorway, in the sprite's pixels
  door?: Position2D;
  // the sprite's edge beam (drawn at the right) stands on the shaft's post, outside the size
  wallBeam: boolean;
  light: LightsID;
}

export const BUILDINGS: Record<BuildingsID, BuildingData> = {
  [BuildingsID.tavern]: {
    name: "Tavern",
    size: { width: 10, height: 19 },
    reserve: { away: 2, up: 2, down: 3 },
    sprite: BUILDING_SHEET.frames.tavern.crop,
    door: BUILDING_SHEET.frames.tavern.door,
    wallBeam: true,
    light: LightsID.buildingLamp,
  },
  [BuildingsID.market]: {
    name: "Market",
    size: { width: 12, height: 6 },
    reserve: { away: 0, up: 0, down: 0 },
    sprite: BUILDING_SHEET.frames.market.crop,
    wallBeam: false,
    light: LightsID.buildingLamp,
  },
  [BuildingsID.brewery]: {
    name: "Brewery",
    size: { width: 11, height: 16 },
    reserve: { away: 2, up: 2, down: 3 },
    sprite: BUILDING_SHEET.frames.brewery.crop,
    wallBeam: true,
    light: LightsID.buildingLamp,
  },
  [BuildingsID.smelter]: {
    name: "Smelter",
    size: { width: 9, height: 9 },
    reserve: { away: 2, up: 2, down: 3 },
    sprite: BUILDING_SHEET.frames.smelter.crop,
    wallBeam: true,
    door: BUILDING_SHEET.frames.smelter.door,
    light: LightsID.buildingLamp,
  },
};

export type BuildLayer = "main" | "deco";

export enum BuildCategoryID {
  shafts,
  buildings,
  stations,
  rails,
}

export interface BuildCategoryData {
  title: string;
  short: string;
  layer: BuildLayer;
}

export const BUILD_CATEGORIES: Record<BuildCategoryID, BuildCategoryData> = {
  [BuildCategoryID.shafts]: { title: "Shafts", short: "Sh", layer: "main" },
  [BuildCategoryID.buildings]: { title: "Buildings", short: "Bu", layer: "main" },
  [BuildCategoryID.stations]: { title: "Stations", short: "St", layer: "main" },
  [BuildCategoryID.rails]: { title: "Rails", short: "Ra", layer: "main" },
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
}

export interface BuildElementData {
  category: BuildCategoryID;
  title: string;
  short: string;
  cost: ResourceCost;
  segment?: number;
  building?: BuildingsID;
  station?: boolean;
  rail?: boolean;
  joint?: boolean;
}

export const BUILD_ELEMENTS: Record<BuildElementID, BuildElementData> = {
  [BuildElementID.shaft20]: {
    category: BuildCategoryID.shafts,
    title: "Shaft, 20 tiles deeper",
    short: "20",
    cost: { [ResourcesID.stone]: 200, [ResourcesID.beer]: 50 },
    segment: 20,
  },
  [BuildElementID.shaft30]: {
    category: BuildCategoryID.shafts,
    title: "Shaft, 30 tiles deeper",
    short: "30",
    cost: { [ResourcesID.stone]: 350, [ResourcesID.beer]: 80 },
    segment: 30,
  },
  [BuildElementID.tavern]: {
    category: BuildCategoryID.buildings,
    title: "Tavern",
    short: "Ta",
    cost: { [ResourcesID.stone]: 100, [ResourcesID.beer]: 20 },
    building: BuildingsID.tavern,
  },
  [BuildElementID.brewery]: {
    category: BuildCategoryID.buildings,
    title: "Brewery",
    short: "Br",
    cost: { [ResourcesID.stone]: 100, [ResourcesID.beer]: 20 },
    building: BuildingsID.brewery,
  },
  [BuildElementID.smelter]: {
    category: BuildCategoryID.buildings,
    title: "Smelter",
    short: "Sm",
    cost: { [ResourcesID.stone]: 100, [ResourcesID.beer]: 20 },
    building: BuildingsID.smelter,
  },
  [BuildElementID.station]: {
    category: BuildCategoryID.stations,
    title: "Station",
    short: "St",
    cost: { [ResourcesID.stone]: 150, [ResourcesID.beer]: 30 },
    station: true,
  },
  [BuildElementID.rail]: {
    category: BuildCategoryID.rails,
    title: "Rail, a tile",
    short: "Ra",
    cost: { [ResourcesID.stone]: 5 },
    rail: true,
  },
  [BuildElementID.shaftJoint]: {
    category: BuildCategoryID.rails,
    title: "Shaft joint",
    short: "Jo",
    cost: { [ResourcesID.stone]: 20 },
    joint: true,
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
