import BUILDING_SHEET from "@sandbox/assets/structures/camp-buildings-spritesheet.json";
import { LightsID } from "./lights";

export const STRUCTURES = {
  plan: { line: 0.08 },
  buildings: {
    maxDepth: 100,
  },
  station: {
    crater: { radius: 9, built: 4, jag: 0.2, bumps: 1.5, fade: 3 },
    reveal: 28,
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
  palisade: {
    size: { width: 4, height: 0.8 },
    hp: 10,
    look: {
      fill: [132, 92, 56, 255] as RGBA,
      border: [86, 56, 32, 255] as RGBA,
      borderWidth: 0.1,
      damagedShade: 0.45,
    },
  },
  metalPalisade: {
    size: { width: 6, height: 0.8 },
    hp: 50,
    look: {
      fill: [130, 140, 152, 255] as RGBA,
      border: [74, 82, 92, 255] as RGBA,
      borderWidth: 0.1,
      damagedShade: 0.45,
    },
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
      lamps: {
        from: 5,
        every: 10,
        light: LightsID.shaftLamp,
        reveal: 12.5,
        radius: 0.2,
        color: [255, 200, 120, 255] as RGBA,
      },
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
  headquarters,
  agh,
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
  reveal: number;
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
    reveal: 28,
  },
  [BuildingsID.market]: {
    name: "Market",
    size: { width: 12, height: 6 },
    reserve: { away: 0, up: 0, down: 0 },
    sprite: BUILDING_SHEET.frames.market.crop,
    wallBeam: false,
    light: LightsID.buildingLamp,
    reveal: 28,
  },
  [BuildingsID.brewery]: {
    name: "Brewery",
    size: { width: 11, height: 16 },
    reserve: { away: 2, up: 2, down: 3 },
    sprite: BUILDING_SHEET.frames.brewery.crop,
    wallBeam: true,
    light: LightsID.buildingLamp,
    reveal: 28,
  },
  [BuildingsID.smelter]: {
    name: "Smelter",
    size: { width: 9, height: 9 },
    reserve: { away: 2, up: 2, down: 3 },
    sprite: BUILDING_SHEET.frames.smelter.crop,
    wallBeam: true,
    door: BUILDING_SHEET.frames.smelter.door,
    light: LightsID.buildingLamp,
    reveal: 28,
  },
  [BuildingsID.headquarters]: {
    name: "Headquarters",
    size: { width: 21, height: 10 },
    reserve: { away: 0, up: 0, down: 0 },
    sprite: BUILDING_SHEET.frames.headquarters.crop,
    door: BUILDING_SHEET.frames.headquarters.door,
    wallBeam: false,
    light: LightsID.buildingLamp,
    reveal: 28,
  },
  [BuildingsID.agh]: {
    name: "AGH",
    size: { width: 18, height: 10 },
    reserve: { away: 0, up: 0, down: 0 },
    sprite: BUILDING_SHEET.frames.agh.crop,
    door: BUILDING_SHEET.frames.agh.door,
    wallBeam: false,
    light: LightsID.buildingLamp,
    reveal: 28,
  },
};
