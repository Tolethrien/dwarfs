import { Light } from "@aurora/urp/draw/draw";
import type { FlashProps, VfxLayer } from "./vfx";

interface ActiveFlash {
  x: number;
  y: number;
  age: number;
  seconds: number;
  radius: number;
  intensity: number;
  color: RGBA;
  occluded: boolean;
}

export default class FlashesLayer implements VfxLayer {
  private readonly flashes: ActiveFlash[] = [];

  public add(props: FlashProps) {
    this.flashes.push({
      x: props.x,
      y: props.y,
      age: 0,
      seconds: props.seconds,
      radius: props.radius,
      intensity: props.intensity,
      color: props.color,
      occluded: props.occluded ?? true,
    });
  }

  public update(delta: number) {
    if (delta === 0 || this.flashes.length === 0) return;
    let kept = 0;
    for (const flash of this.flashes) {
      flash.age += delta;
      if (flash.age < flash.seconds) this.flashes[kept++] = flash;
    }
    this.flashes.length = kept;
  }

  public render() {
    for (const flash of this.flashes) {
      const left = 1 - flash.age / flash.seconds;
      Light.point({
        position: { x: flash.x, y: flash.y },
        radius: flash.radius,
        color: flash.color,
        intensity: flash.intensity * left * left,
        occluded: flash.occluded,
      });
    }
  }

  public clear() {
    this.flashes.length = 0;
  }
}
