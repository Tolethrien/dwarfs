import type Effect from "../effects/effect";
import { pierce } from "../effects/pierce";
import { splash } from "../effects/splash";
import { LightsID } from "./lights";

export enum MainTraitsID {
  intern,
  miner,
  pyro,
}

export interface TraitData {
  name: string;
  description: string;
  effects: Effect[];
}

export interface MainTraitData extends TraitData {
  // in BALL.pixelsPerSpeed
  speed: number;
  power: number;
  // beer per game hour, the wage is shift hours × bph
  bph: number;
  light: LightsID;
  // shows up among the tavern's applications only once the player has this plan
  plan?: string;
}

export const MAIN_TRAITS: Record<MainTraitsID, MainTraitData> = {
  [MainTraitsID.intern]: {
    name: "Intern",
    description: "Covers the basics of digging. Neither fast nor trained, but gets the job done.",
    effects: [],
    speed: 3,
    power: 3,
    bph: 2,
    light: LightsID.helmet,
  },
  [MainTraitsID.miner]: {
    name: "Miner",
    description: "The backbone of most mines: strong, diligent and fairly sober.",
    effects: [],
    speed: 3,
    power: 4,
    bph: 4,
    light: LightsID.helmetCone,
  },
  [MainTraitsID.pyro]: {
    name: "Pyro",
    description: "A blasting specialist: sprinkles saltpetre around the rock, so every pick strike also hurts the blocks next to it.",
    effects: [splash({ radius: 1, damage: 3 })],
    speed: 3,
    power: 3,
    bph: 5,
    light: LightsID.helmet,
    plan: "pyro",
  },
};

// Object.keys gives enum numbers as strings
export const MAIN_TRAIT_IDS = Object.keys(MAIN_TRAITS).map(Number) as MainTraitsID[];

export const FOREMAN_TRAIT: TraitData = {
  name: "Foreman",
  description: "Piercing flight: breaks through blocks at the start of the shot.",
  effects: [pierce({ untilSpeed: 1.05, overSpeedPower: 0.3 })],
};

// the ids go to the save, keep them stable
export enum TraitsID {
  tired,
}

export const TRAITS: Record<TraitsID, TraitData> = {
  [TraitsID.tired]: {
    name: "Tired",
    description: "Morale fell below 30: won't go to work until it's back to 60.",
    effects: [],
  },
};

export enum WorkerTraitID {}

export const WORKER_TRAITS: Record<WorkerTraitID, TraitData> = {};

// Object.keys gives enum numbers as strings
export const WORKER_IDS = Object.keys(WORKER_TRAITS).map(Number) as WorkerTraitID[];
