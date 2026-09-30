export default class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  // an independent seed per salt, so one stream does not shift when another draws more
  static derive(seed: number, salt: number) {
    let hash = Math.imul(seed ^ Math.imul(salt, 0x9e3779b9), 0x85ebca6b);
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
    return (hash ^ (hash >>> 16)) | 0;
  }

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(min: number, max: number) {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number) {
    return Math.floor(this.float(min, max + 1));
  }

  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }

  bool(chance = 0.5) {
    return this.next() < chance;
  }

  weightedRandom<T>(items: T[], weights: number[]): T {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let roll = this.next() * totalWeight;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  arrayIndex(array: readonly unknown[]) {
    return this.int(0, array.length - 1);
  }

  inCirclePoint(center: Position2D, radius: number) {
    const angle = this.float(0, Math.PI * 2);
    const r = radius * Math.sqrt(this.next());
    return {
      x: center.x + r * Math.cos(angle),
      y: center.y + r * Math.sin(angle),
    };
  }

  inRectPoint(shape: Box | BoxAABB) {
    if ("min" in shape) {
      return {
        x: this.float(shape.min.x, shape.max.x),
        y: this.float(shape.min.y, shape.max.y),
      };
    }
    return {
      x: this.float(shape.x, shape.x + shape.w),
      y: this.float(shape.y, shape.y + shape.h),
    };
  }
}
