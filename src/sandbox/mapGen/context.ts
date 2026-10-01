import type Noise from "@axiom/noise";
import type SeededRandom from "@axiom/seedRandom";
import { BlocksID } from "../content/blocks";
import type { Tile } from "../world/tile";

export type Range = readonly [number, number];

export const NEIGHBOURS = {
  four: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
  eight: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
} as const;

export interface PassTools {
  random: SeededRandom;
  noise: Noise;
}

// row-major (gx + gy * width) while generating: neighbours and flood fills stay simple, chunk-major only at the end
export default class GenContext {
  readonly width: number;
  readonly height: number;
  readonly solid: Uint16Array;
  readonly mask: Uint8Array;
  readonly border: Tile;

  // writes straight into the world's array, no copy at the end
  constructor(solid: Uint16Array, size: Size2D, border: Tile) {
    this.width = size.width;
    this.height = size.height;
    this.solid = solid;
    this.mask = new Uint8Array(size.width * size.height);
    this.border = border;
  }

  index(gx: number, gy: number) {
    return gx + gy * this.width;
  }

  inside(gx: number, gy: number) {
    return gx >= 0 && gy >= 0 && gx < this.width && gy < this.height;
  }

  playable(gx: number, gy: number) {
    return this.inside(gx, gy) && this.mask[this.index(gx, gy)] === 1;
  }

  get(gx: number, gy: number): Tile {
    if (!this.inside(gx, gy)) return this.border;
    return this.solid[this.index(gx, gy)];
  }

  set(gx: number, gy: number, type: Tile) {
    if (this.playable(gx, gy)) this.solid[this.index(gx, gy)] = type;
  }

  isAir(gx: number, gy: number) {
    return this.playable(gx, gy) && this.get(gx, gy) === BlocksID.air;
  }

  // anything an ore, a crater or a chest may replace
  isGround(gx: number, gy: number) {
    if (!this.playable(gx, gy)) return false;
    const type = this.get(gx, gy);
    return type !== BlocksID.air && type !== BlocksID.hiddenChest;
  }

  touchesAir(gx: number, gy: number) {
    return (
      this.isAir(gx + 1, gy) ||
      this.isAir(gx - 1, gy) ||
      this.isAir(gx, gy + 1) ||
      this.isAir(gx, gy - 1)
    );
  }

  nearAir(gx: number, gy: number, radius: number) {
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++)
        if (this.isAir(gx + dx, gy + dy)) return true;
    return false;
  }

  stamp(
    center: Position2D,
    radius: number,
    type: Tile,
    filter: (gx: number, gy: number) => boolean = () => true,
  ) {
    const reach = Math.ceil(radius);
    const radiusSquared = radius * radius;
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        if (dx * dx + dy * dy > radiusSquared) continue;
        const gx = Math.round(center.x) + dx;
        const gy = Math.round(center.y) + dy;
        if (filter(gx, gy)) this.set(gx, gy, type);
      }
    }
  }
}
