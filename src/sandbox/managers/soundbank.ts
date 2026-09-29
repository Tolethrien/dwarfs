import Cello, { CategoryTree } from "@cello/cello";

interface SoundObject {
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
}
interface PlayProps {
  volume?: number;
  position?: Position2D;
}

export default class SoundBank {
  public static categoryTree: Record<string, CategoryTree> = {
    ambient: {
      initVol: 1,
      children: { music: { initVol: 1 }, ambientEffects: { initVol: 1 } },
    },
    soundEffects: { initVol: 1, children: { mineSounds: { initVol: 1 } } },
  };
  private static sounds: Record<SoundsID, SoundObject> = {
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
  };
  public static playSound(soundName: SoundsID, props?: PlayProps) {
    const data = this.sounds[soundName];
    return Cello.play(data.name, {
      categories: data.categories,
      loop: false,
      effects: data.effects,
      volume: props?.volume,
      randomPitch: data.randomPitch,
      position: props?.position,
      maxConcurrent: data.maxConcurrent,
    });
  }
  public static loopSound(soundName: SoundsID, props?: PlayProps) {
    const data = this.sounds[soundName];
    return Cello.play(data.name, {
      categories: data.categories,
      loop: true,
      effects: data.effects,
      volume: props?.volume,
      position: props?.position,
      randomPitch: data.randomPitch,
      maxConcurrent: data.maxConcurrent,
    });
  }
}
