import Cello from "@/core/cello/cello";

interface SoundObject {
  name: string;
  categories: string[];
}
export enum SoundsID {
  blockDamage,
  ambientOne,
}
export default class SoundBank {
  public static categories = {
    ambient: 1,
    soundEffects: 1,
  };
  private static sounds: Record<SoundsID, SoundObject> = {
    [SoundsID.blockDamage]: {
      categories: ["soundEffects"],
      name: "blockDamage",
    },
    [SoundsID.ambientOne]: { categories: ["ambient"], name: "mineAmbient" },
  };
  public static playSound(soundName: SoundsID) {
    const data = this.sounds[soundName];
    Cello.play(data.name, { categories: data.categories, loop: false });
  }
  public static loopSound(soundName: SoundsID) {
    const data = this.sounds[soundName];
    console.log(data);
    Cello.play(data.name, { categories: data.categories, loop: true });
  }
}
