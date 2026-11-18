import type Effect from "../effects/effect";
import Pierce from "../effects/pierce";
import Splash from "../effects/splash";

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
}

export const MAIN_TRAITS: Record<MainTraitsID, MainTraitData> = {
  [MainTraitsID.intern]: {
    name: "Intern",
    description: "Covers the basics of digging. Neither fast nor trained, but gets the job done.",
    effects: [],
    speed: 3,
    power: 2,
    bph: 2,
  },
  [MainTraitsID.miner]: {
    name: "Miner",
    description: "The backbone of most mines: strong, diligent and fairly sober.",
    effects: [],
    speed: 3,
    power: 4,
    bph: 4,
  },
  [MainTraitsID.pyro]: {
    name: "Pyro",
    description: "A blasting specialist: sprinkles saltpetre around the rock, so every pick strike also hurts the blocks next to it.",
    effects: [new Splash({ radius: 1, damage: 3 })],
    speed: 3,
    power: 3,
    bph: 5,
  },
};

export const FOREMAN_TRAIT: TraitData = {
  name: "Foreman",
  description: "Piercing flight: breaks through blocks at the start of the shot.",
  effects: [new Pierce({ untilSpeed: 1.05, overSpeedPower: 0.3 })],
};

export enum TraitsID {}

export const TRAITS: Record<TraitsID, TraitData> = {};

export enum WorkerTraitID {}

export const WORKER_TRAITS: Record<WorkerTraitID, TraitData> = {};

// Object.keys gives enum numbers as strings
export const WORKER_IDS = Object.keys(WORKER_TRAITS).map(Number) as WorkerTraitID[];
