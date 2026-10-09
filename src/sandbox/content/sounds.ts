import type { CategoryTree } from "@cello/cello";

export interface SoundData {
  name: string;
  categories: string[];
  effects?: string[];
  randomPitch?: number;
  maxConcurrent?: number;
}

export enum SoundsID {
  none,
  blockDamage,
  blockDestroy,
  ambientOne,
  ambientNew,
}

export const SOUND_CATEGORIES: Record<string, CategoryTree> = {
  ambient: {
    initVol: 1,
    children: { music: { initVol: 1 }, ambientEffects: { initVol: 1 } },
  },
  soundEffects: { initVol: 1, children: { mineSounds: { initVol: 1 } } },
};

export const SOUNDS: Record<SoundsID, SoundData> = {
  [SoundsID.none]: {
    categories: ["soundEffects"],
    name: "blockDamage",
  },
  [SoundsID.blockDamage]: {
    categories: ["soundEffects"],
    name: "blockDamage",
    effects: ["caveReverbEffect", "distanceVolumeEffect", "zoomVolume"],
    randomPitch: 0.3,
    maxConcurrent: 6,
  },
  [SoundsID.blockDestroy]: {
    categories: ["soundEffects"],
    name: "blockDestroy",
    effects: ["distanceVolumeEffect", "zoomVolume"],
    maxConcurrent: 3,
  },
  [SoundsID.ambientOne]: { categories: ["ambient"], name: "mineAmbient" },
  [SoundsID.ambientNew]: { categories: ["ambient"], name: "mineAmbientNew" },
};
