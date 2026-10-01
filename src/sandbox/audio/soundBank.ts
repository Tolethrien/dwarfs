import Cello from "@cello/cello";
import { SOUNDS, SoundsID } from "../content/sounds";

interface PlayProps {
  volume?: number;
  position?: Position2D;
}

export default class SoundBank {
  public static playSound(soundName: SoundsID, props?: PlayProps) {
    const data = SOUNDS[soundName];
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
    const data = SOUNDS[soundName];
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
