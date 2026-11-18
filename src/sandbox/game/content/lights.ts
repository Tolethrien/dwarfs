export enum LightsID {
  helmet,
  lantern,
  soulLantern,
  mushroomGlow,
  shaftLamp,
  buildingLamp,
  cargo,
}

export interface LightData {
  color: RGBA;
  radius: number;
  intensity: number;
  falloff?: number;
  flicker?: { amount: number; speed: number };
  // how bright the lamp itself is drawn, unlit: past 1 it blooms
  glow?: number;
}

export const LIGHT_FALLOFF = 0.5;

export const LIGHTS: Record<LightsID, LightData> = {
  [LightsID.helmet]: { color: [255, 205, 150, 255], radius: 760, intensity: 1.6 },
  [LightsID.cargo]: { color: [255, 205, 150, 255], radius: 450, intensity: 0.8 },
  [LightsID.lantern]: {
    color: [255, 160, 80, 255],
    radius: 640,
    intensity: 1.5,
    flicker: { amount: 0.2, speed: 7 },
    glow: 2,
  },
  [LightsID.soulLantern]: {
    color: [110, 170, 255, 255],
    radius: 700,
    intensity: 1.5,
    flicker: { amount: 0.35, speed: 0.8 },
    glow: 2,
  },
  [LightsID.mushroomGlow]: {
    color: [140, 255, 120, 255],
    radius: 480,
    intensity: 1.1,
    flicker: { amount: 0.25, speed: 0.5 },
    glow: 1.8,
  },
  [LightsID.buildingLamp]: {
    color: [255, 200, 140, 255],
    radius: 1100,
    intensity: 1.4,
    flicker: { amount: 0.06, speed: 2 },
  },
  [LightsID.shaftLamp]: {
    color: [255, 190, 120, 255],
    radius: 480,
    intensity: 1.3,
    flicker: { amount: 0.08, speed: 3 },
    glow: 3,
  },
};
