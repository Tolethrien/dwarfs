export enum LightsID {
  helmet,
  lantern,
  soulLantern,
  mushroomAmber,
  mushroomCyan,
  mushroomViolet,
  mushroomEmerald,
  mushroomCrimson,
  mushroomBone,
  shelfMushroomBrown,
  shelfMushroomBlue,
  shelfMushroomRust,
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

export const LIGHT_FALLOFF = 4;

export const MUSHROOM_LIGHTS = {
  floor: [
    LightsID.mushroomAmber,
    LightsID.mushroomCyan,
    LightsID.mushroomViolet,
    LightsID.mushroomEmerald,
    LightsID.mushroomCrimson,
    LightsID.mushroomBone,
  ],
  shelf: [
    LightsID.shelfMushroomBrown,
    LightsID.shelfMushroomBlue,
    LightsID.shelfMushroomRust,
  ],
} as const;

const MUSHROOM_LIGHT = {
  floor: { radius: 200, intensity: 0 },
  shelf: { radius: 160, intensity: 0 },
  flicker: { amount: 0.2, speed: 0.45 },
};

function mushroomLight(color: RGBA, kind: "floor" | "shelf", glow: number): LightData {
  const preset = MUSHROOM_LIGHT[kind];
  return {
    color: color,
    radius: preset.radius,
    intensity: preset.intensity,
    flicker: { ...MUSHROOM_LIGHT.flicker },
    glow: glow,
  };
}

export const LIGHTS: Record<LightsID, LightData> = {
  [LightsID.helmet]: { color: [255, 205, 150, 255], radius: 950, intensity: 1.15, falloff: 6 },
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
  [LightsID.mushroomAmber]: mushroomLight([255, 175, 70, 255], "floor", 4.0),
  [LightsID.mushroomCyan]: mushroomLight([70, 235, 255, 255], "floor", 5.8),
  [LightsID.mushroomViolet]: mushroomLight([195, 110, 255, 255], "floor", 10.0),
  [LightsID.mushroomEmerald]: mushroomLight([120, 255, 130, 255], "floor", 9.5),
  [LightsID.mushroomCrimson]: mushroomLight([255, 95, 75, 255], "floor", 6.0),
  [LightsID.mushroomBone]: mushroomLight([235, 225, 195, 255], "floor", 4.2),
  [LightsID.shelfMushroomBrown]: mushroomLight([225, 165, 95, 255], "shelf", 4.8),
  [LightsID.shelfMushroomBlue]: mushroomLight([110, 200, 255, 255], "shelf", 5.8),
  [LightsID.shelfMushroomRust]: mushroomLight([255, 135, 65, 255], "shelf", 4.4),
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
