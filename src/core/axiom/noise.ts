import SeededRandom from "./seedRandom";

export type NoiseBase = "value" | "perlin" | "simplex";
export type FractalMode = "fbm" | "turbulence" | "billow" | "ridged";
export type WorleyMetric = "euclidean" | "manhattan" | "chebyshev";
export type WorleyOutput = "f1" | "f2" | "f2-f1";

export interface FractalOptions {
  base: NoiseBase;
  mode: FractalMode;
  octaves: number;
  lacunarity: number;
  gain: number;
}
export interface WorleyOptions {
  metric: WorleyMetric;
  output: WorleyOutput;
  jitter: number;
}

export const FRACTAL_DEFAULTS: FractalOptions = {
  base: "perlin",
  mode: "fbm",
  octaves: 5,
  lacunarity: 2,
  gain: 0.5,
};
export const WORLEY_DEFAULTS: WorleyOptions = {
  metric: "euclidean",
  output: "f1",
  jitter: 1,
};

const SIMPLEX = {
  F2: 0.5 * (Math.sqrt(3) - 1),
  G2: (3 - Math.sqrt(3)) / 6,
  F3: 1 / 3,
  G3: 1 / 6,
  scale2: 70,
  scale3: 76,
};
const PERLIN_SCALE = { 1: 2, 2: Math.SQRT2, 3: 1 };
const GRAD2 = new Float64Array([
  1,
  0,
  -1,
  0,
  0,
  1,
  0,
  -1,
  Math.SQRT1_2,
  Math.SQRT1_2,
  -Math.SQRT1_2,
  Math.SQRT1_2,
  Math.SQRT1_2,
  -Math.SQRT1_2,
  -Math.SQRT1_2,
  -Math.SQRT1_2,
]);
const GRAD3 = new Float64Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0,
  -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
]);
const SEED_STEP = 0x9e3779b9;
const OCTAVE_SHIFT = { x: 17.31, y: 9.73, z: 5.19 };
const WARP_OFFSET = { x: 5.2, y: 1.3, z: 9.7 };
const UINT = 4294967296;

export default class Noise {
  private readonly seed: number;

  constructor(seed = 0) {
    this.seed = Noise.hash(seed | 0, 0, 0, 0x5bd1e995);
  }

  public white1D(x: number) {
    return Noise.hash(Math.floor(x), 0, 0, this.seed) / UINT;
  }
  public white2D(x: number, y: number) {
    return Noise.hash(Math.floor(x), Math.floor(y), 0, this.seed) / UINT;
  }
  public white3D(x: number, y: number, z: number) {
    return (
      Noise.hash(Math.floor(x), Math.floor(y), Math.floor(z), this.seed) / UINT
    );
  }

  public value1D(x: number) {
    return Noise.value1(x, this.seed);
  }
  public value2D(x: number, y: number) {
    return Noise.value2(x, y, this.seed);
  }
  public value3D(x: number, y: number, z: number) {
    return Noise.value3(x, y, z, this.seed);
  }
  public perlin1D(x: number) {
    return Noise.perlin1(x, this.seed);
  }
  public perlin2D(x: number, y: number) {
    return Noise.perlin2(x, y, this.seed);
  }
  public perlin3D(x: number, y: number, z: number) {
    return Noise.perlin3(x, y, z, this.seed);
  }
  public simplex2D(x: number, y: number) {
    return Noise.simplex2(x, y, this.seed);
  }
  public simplex3D(x: number, y: number, z: number) {
    return Noise.simplex3(x, y, z, this.seed);
  }

  public worley2D(
    x: number,
    y: number,
    options: Partial<WorleyOptions> = WORLEY_DEFAULTS,
  ) {
    const metric = options.metric ?? WORLEY_DEFAULTS.metric;
    const jitter = options.jitter ?? WORLEY_DEFAULTS.jitter;
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    let f1 = Infinity;
    let f2 = Infinity;
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        const pointX = cellX + offsetX;
        const pointY = cellY + offsetY;
        const featureX =
          pointX +
          0.5 +
          (Noise.hash(pointX, pointY, 0, this.seed) / UINT - 0.5) * jitter;
        const featureY =
          pointY +
          0.5 +
          (Noise.hash(pointX, pointY, 1, this.seed) / UINT - 0.5) * jitter;
        const distance = Noise.distance(featureX - x, featureY - y, 0, metric);
        if (distance < f1) {
          f2 = f1;
          f1 = distance;
        } else if (distance < f2) {
          f2 = distance;
        }
      }
    }
    return Noise.worleyOutput(f1, f2, options.output ?? WORLEY_DEFAULTS.output);
  }
  public worley3D(
    x: number,
    y: number,
    z: number,
    options: Partial<WorleyOptions> = WORLEY_DEFAULTS,
  ) {
    const metric = options.metric ?? WORLEY_DEFAULTS.metric;
    const jitter = options.jitter ?? WORLEY_DEFAULTS.jitter;
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const cellZ = Math.floor(z);
    let f1 = Infinity;
    let f2 = Infinity;
    for (let offsetZ = -1; offsetZ <= 1; offsetZ++) {
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          const pointX = cellX + offsetX;
          const pointY = cellY + offsetY;
          const pointZ = cellZ + offsetZ;
          const seed = this.seed;
          const featureX =
            pointX +
            0.5 +
            (Noise.hash(pointX, pointY, pointZ, seed) / UINT - 0.5) * jitter;
          const featureY =
            pointY +
            0.5 +
            (Noise.hash(pointX, pointY, pointZ, seed + 1) / UINT - 0.5) *
              jitter;
          const featureZ =
            pointZ +
            0.5 +
            (Noise.hash(pointX, pointY, pointZ, seed + 2) / UINT - 0.5) *
              jitter;
          const distance = Noise.distance(
            featureX - x,
            featureY - y,
            featureZ - z,
            metric,
          );
          if (distance < f1) {
            f2 = f1;
            f1 = distance;
          } else if (distance < f2) {
            f2 = distance;
          }
        }
      }
    }
    return Noise.worleyOutput(f1, f2, options.output ?? WORLEY_DEFAULTS.output);
  }

  public fractal1D(
    x: number,
    options: Partial<FractalOptions> = FRACTAL_DEFAULTS,
  ) {
    return this.fractal(1, x, 0, 0, options);
  }
  public fractal2D(
    x: number,
    y: number,
    options: Partial<FractalOptions> = FRACTAL_DEFAULTS,
  ) {
    return this.fractal(2, x, y, 0, options);
  }
  public fractal3D(
    x: number,
    y: number,
    z: number,
    options: Partial<FractalOptions> = FRACTAL_DEFAULTS,
  ) {
    return this.fractal(3, x, y, z, options);
  }

  public warp2D(
    x: number,
    y: number,
    strength: number,
    options: Partial<FractalOptions> = FRACTAL_DEFAULTS,
  ) {
    const pushX = this.fractal(2, x, y, 0, options);
    const pushY = this.fractal(
      2,
      x + WARP_OFFSET.x,
      y + WARP_OFFSET.y,
      0,
      options,
    );
    return this.fractal(
      2,
      x + pushX * strength,
      y + pushY * strength,
      0,
      options,
    );
  }
  public warp3D(
    x: number,
    y: number,
    z: number,
    strength: number,
    options: Partial<FractalOptions> = FRACTAL_DEFAULTS,
  ) {
    const pushX = this.fractal(3, x, y, z, options);
    const pushY = this.fractal(
      3,
      x + WARP_OFFSET.x,
      y + WARP_OFFSET.y,
      z + WARP_OFFSET.z,
      options,
    );
    const pushZ = this.fractal(
      3,
      x + WARP_OFFSET.z,
      y + WARP_OFFSET.x,
      z + WARP_OFFSET.y,
      options,
    );
    return this.fractal(
      3,
      x + pushX * strength,
      y + pushY * strength,
      z + pushZ * strength,
      options,
    );
  }

  public poissonDisk(
    bounds: BoxAABB,
    minDistance: number,
    attempts = 30,
  ): Position2D[] {
    const random = new SeededRandom(this.seed);
    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.y - bounds.min.y;
    const cellSize = minDistance / Math.SQRT2;
    const columns = Math.max(1, Math.ceil(width / cellSize));
    const rows = Math.max(1, Math.ceil(height / cellSize));
    const grid = new Int32Array(columns * rows).fill(-1);
    const points: Position2D[] = [];
    const active: number[] = [];
    const minSquared = minDistance * minDistance;

    const add = (x: number, y: number) => {
      const column = Math.min(
        columns - 1,
        Math.floor((x - bounds.min.x) / cellSize),
      );
      const row = Math.min(rows - 1, Math.floor((y - bounds.min.y) / cellSize));
      grid[row * columns + column] = points.length;
      active.push(points.length);
      points.push({ x, y });
    };
    const fits = (x: number, y: number) => {
      if (
        x < bounds.min.x ||
        x >= bounds.max.x ||
        y < bounds.min.y ||
        y >= bounds.max.y
      ) {
        return false;
      }
      const column = Math.floor((x - bounds.min.x) / cellSize);
      const row = Math.floor((y - bounds.min.y) / cellSize);
      for (
        let nearRow = Math.max(0, row - 2);
        nearRow <= Math.min(rows - 1, row + 2);
        nearRow++
      ) {
        for (
          let nearColumn = Math.max(0, column - 2);
          nearColumn <= Math.min(columns - 1, column + 2);
          nearColumn++
        ) {
          const index = grid[nearRow * columns + nearColumn];
          if (index === -1) continue;
          const point = points[index];
          const distanceX = point.x - x;
          const distanceY = point.y - y;
          if (distanceX * distanceX + distanceY * distanceY < minSquared)
            return false;
        }
      }
      return true;
    };

    add(
      random.float(bounds.min.x, bounds.max.x),
      random.float(bounds.min.y, bounds.max.y),
    );
    while (active.length > 0) {
      const slot = random.int(0, active.length - 1);
      const origin = points[active[slot]];
      let found = false;
      for (let attempt = 0; attempt < attempts; attempt++) {
        const angle = random.float(0, Math.PI * 2);
        const radius = random.float(minDistance, minDistance * 2);
        const x = origin.x + Math.cos(angle) * radius;
        const y = origin.y + Math.sin(angle) * radius;
        if (!fits(x, y)) continue;
        add(x, y);
        found = true;
        break;
      }
      if (found) continue;
      active[slot] = active[active.length - 1];
      active.pop();
    }
    return points;
  }

  private fractal(
    dimensions: 1 | 2 | 3,
    x: number,
    y: number,
    z: number,
    options: Partial<FractalOptions>,
  ) {
    const base = options.base ?? FRACTAL_DEFAULTS.base;
    const mode = options.mode ?? FRACTAL_DEFAULTS.mode;
    const octaves = options.octaves ?? FRACTAL_DEFAULTS.octaves;
    const lacunarity = options.lacunarity ?? FRACTAL_DEFAULTS.lacunarity;
    const gain = options.gain ?? FRACTAL_DEFAULTS.gain;
    let sum = 0;
    let weight = 1;
    let total = 0;
    let frequency = 1;
    for (let octave = 0; octave < octaves; octave++) {
      const seed = (this.seed + Math.imul(octave, SEED_STEP)) | 0;
      const sample = Noise.base(
        base,
        dimensions,
        x * frequency + octave * OCTAVE_SHIFT.x,
        y * frequency + octave * OCTAVE_SHIFT.y,
        z * frequency + octave * OCTAVE_SHIFT.z,
        seed,
      );
      sum += Noise.shape(sample, mode) * weight;
      total += weight;
      weight *= gain;
      frequency *= lacunarity;
    }
    return total > 0 ? sum / total : 0;
  }

  private static base(
    base: NoiseBase,
    dimensions: 1 | 2 | 3,
    x: number,
    y: number,
    z: number,
    seed: number,
  ) {
    if (dimensions === 1) {
      // simplex has no 1D form, perlin is its 1D equivalent
      return base === "value" ? Noise.value1(x, seed) : Noise.perlin1(x, seed);
    }
    if (dimensions === 2) {
      if (base === "value") return Noise.value2(x, y, seed);
      return base === "perlin"
        ? Noise.perlin2(x, y, seed)
        : Noise.simplex2(x, y, seed);
    }
    if (base === "value") return Noise.value3(x, y, z, seed);
    return base === "perlin"
      ? Noise.perlin3(x, y, z, seed)
      : Noise.simplex3(x, y, z, seed);
  }
  private static shape(sample: number, mode: FractalMode) {
    if (mode === "fbm") return sample;
    const folded = Math.abs(sample);
    if (mode === "turbulence") return folded;
    if (mode === "billow") return folded * 2 - 1;
    const ridge = 1 - folded;
    return ridge * ridge;
  }

  private static hash(x: number, y: number, z: number, seed: number) {
    let hash =
      Math.imul(x, 0x8da6b343) ^
      Math.imul(y, 0xd8163841) ^
      Math.imul(z, 0xcb1ab31f) ^
      seed;
    hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
    hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
    return (hash ^ (hash >>> 16)) >>> 0;
  }
  private static signed(x: number, y: number, z: number, seed: number) {
    return (Noise.hash(x, y, z, seed) / UINT) * 2 - 1;
  }
  private static fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  private static lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  private static value1(x: number, seed: number) {
    const cell = Math.floor(x);
    const t = Noise.fade(x - cell);
    return Noise.lerp(
      Noise.signed(cell, 0, 0, seed),
      Noise.signed(cell + 1, 0, 0, seed),
      t,
    );
  }
  private static value2(x: number, y: number, seed: number) {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const u = Noise.fade(x - cellX);
    const v = Noise.fade(y - cellY);
    const top = Noise.lerp(
      Noise.signed(cellX, cellY, 0, seed),
      Noise.signed(cellX + 1, cellY, 0, seed),
      u,
    );
    const bottom = Noise.lerp(
      Noise.signed(cellX, cellY + 1, 0, seed),
      Noise.signed(cellX + 1, cellY + 1, 0, seed),
      u,
    );
    return Noise.lerp(top, bottom, v);
  }
  private static value3(x: number, y: number, z: number, seed: number) {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const cellZ = Math.floor(z);
    const u = Noise.fade(x - cellX);
    const v = Noise.fade(y - cellY);
    const w = Noise.fade(z - cellZ);
    return Noise.lerp(
      Noise.valueLayer(cellX, cellY, cellZ, u, v, seed),
      Noise.valueLayer(cellX, cellY, cellZ + 1, u, v, seed),
      w,
    );
  }
  private static valueLayer(
    cellX: number,
    cellY: number,
    cellZ: number,
    u: number,
    v: number,
    seed: number,
  ) {
    const top = Noise.lerp(
      Noise.signed(cellX, cellY, cellZ, seed),
      Noise.signed(cellX + 1, cellY, cellZ, seed),
      u,
    );
    const bottom = Noise.lerp(
      Noise.signed(cellX, cellY + 1, cellZ, seed),
      Noise.signed(cellX + 1, cellY + 1, cellZ, seed),
      u,
    );
    return Noise.lerp(top, bottom, v);
  }

  private static perlin1(x: number, seed: number) {
    const cell = Math.floor(x);
    const local = x - cell;
    const a = Noise.signed(cell, 0, 0, seed) * local;
    const b = Noise.signed(cell + 1, 0, 0, seed) * (local - 1);
    return Noise.lerp(a, b, Noise.fade(local)) * PERLIN_SCALE[1];
  }
  private static perlin2(x: number, y: number, seed: number) {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const localX = x - cellX;
    const localY = y - cellY;
    const u = Noise.fade(localX);
    const v = Noise.fade(localY);
    const top = Noise.lerp(
      Noise.grad2(Noise.hash(cellX, cellY, 0, seed), localX, localY),
      Noise.grad2(Noise.hash(cellX + 1, cellY, 0, seed), localX - 1, localY),
      u,
    );
    const bottom = Noise.lerp(
      Noise.grad2(Noise.hash(cellX, cellY + 1, 0, seed), localX, localY - 1),
      Noise.grad2(
        Noise.hash(cellX + 1, cellY + 1, 0, seed),
        localX - 1,
        localY - 1,
      ),
      u,
    );
    return Noise.lerp(top, bottom, v) * PERLIN_SCALE[2];
  }
  private static perlin3(x: number, y: number, z: number, seed: number) {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const cellZ = Math.floor(z);
    const localX = x - cellX;
    const localY = y - cellY;
    const localZ = z - cellZ;
    const u = Noise.fade(localX);
    const v = Noise.fade(localY);
    const w = Noise.fade(localZ);
    const near = Noise.perlinLayer(
      cellX,
      cellY,
      cellZ,
      localX,
      localY,
      localZ,
      u,
      v,
      seed,
    );
    const far = Noise.perlinLayer(
      cellX,
      cellY,
      cellZ + 1,
      localX,
      localY,
      localZ - 1,
      u,
      v,
      seed,
    );
    return Noise.lerp(near, far, w) * PERLIN_SCALE[3];
  }
  private static perlinLayer(
    cellX: number,
    cellY: number,
    cellZ: number,
    localX: number,
    localY: number,
    localZ: number,
    u: number,
    v: number,
    seed: number,
  ) {
    const top = Noise.lerp(
      Noise.grad3(
        Noise.hash(cellX, cellY, cellZ, seed),
        localX,
        localY,
        localZ,
      ),
      Noise.grad3(
        Noise.hash(cellX + 1, cellY, cellZ, seed),
        localX - 1,
        localY,
        localZ,
      ),
      u,
    );
    const bottom = Noise.lerp(
      Noise.grad3(
        Noise.hash(cellX, cellY + 1, cellZ, seed),
        localX,
        localY - 1,
        localZ,
      ),
      Noise.grad3(
        Noise.hash(cellX + 1, cellY + 1, cellZ, seed),
        localX - 1,
        localY - 1,
        localZ,
      ),
      u,
    );
    return Noise.lerp(top, bottom, v);
  }

  private static simplex2(x: number, y: number, seed: number) {
    const { F2, G2 } = SIMPLEX;
    const skew = (x + y) * F2;
    const cellX = Math.floor(x + skew);
    const cellY = Math.floor(y + skew);
    const unskew = (cellX + cellY) * G2;
    const x0 = x - (cellX - unskew);
    const y0 = y - (cellY - unskew);
    const stepX = x0 > y0 ? 1 : 0;
    const stepY = 1 - stepX;
    const x1 = x0 - stepX + G2;
    const y1 = y0 - stepY + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const n0 = Noise.simplexCorner2(Noise.hash(cellX, cellY, 0, seed), x0, y0);
    const n1 = Noise.simplexCorner2(
      Noise.hash(cellX + stepX, cellY + stepY, 0, seed),
      x1,
      y1,
    );
    const n2 = Noise.simplexCorner2(
      Noise.hash(cellX + 1, cellY + 1, 0, seed),
      x2,
      y2,
    );
    return SIMPLEX.scale2 * (n0 + n1 + n2);
  }
  private static simplexCorner2(hash: number, x: number, y: number) {
    let falloff = 0.5 - x * x - y * y;
    if (falloff <= 0) return 0;
    falloff *= falloff;
    return falloff * falloff * Noise.grad3(hash, x, y, 0);
  }
  private static simplex3(x: number, y: number, z: number, seed: number) {
    const { F3, G3 } = SIMPLEX;
    const skew = (x + y + z) * F3;
    const cellX = Math.floor(x + skew);
    const cellY = Math.floor(y + skew);
    const cellZ = Math.floor(z + skew);
    const unskew = (cellX + cellY + cellZ) * G3;
    const x0 = x - (cellX - unskew);
    const y0 = y - (cellY - unskew);
    const z0 = z - (cellZ - unskew);
    const i1 = x0 >= y0 && x0 >= z0 ? 1 : 0;
    const j1 = y0 > x0 && y0 >= z0 ? 1 : 0;
    const k1 = 1 - i1 - j1;
    const i2 = x0 >= y0 || x0 >= z0 ? 1 : 0;
    const j2 = y0 > x0 || y0 >= z0 ? 1 : 0;
    const k2 = 2 - i2 - j2;
    const n0 = Noise.simplexCorner3(
      Noise.hash(cellX, cellY, cellZ, seed),
      x0,
      y0,
      z0,
    );
    const n1 = Noise.simplexCorner3(
      Noise.hash(cellX + i1, cellY + j1, cellZ + k1, seed),
      x0 - i1 + G3,
      y0 - j1 + G3,
      z0 - k1 + G3,
    );
    const n2 = Noise.simplexCorner3(
      Noise.hash(cellX + i2, cellY + j2, cellZ + k2, seed),
      x0 - i2 + 2 * G3,
      y0 - j2 + 2 * G3,
      z0 - k2 + 2 * G3,
    );
    const n3 = Noise.simplexCorner3(
      Noise.hash(cellX + 1, cellY + 1, cellZ + 1, seed),
      x0 - 1 + 3 * G3,
      y0 - 1 + 3 * G3,
      z0 - 1 + 3 * G3,
    );
    return SIMPLEX.scale3 * (n0 + n1 + n2 + n3);
  }
  private static simplexCorner3(hash: number, x: number, y: number, z: number) {
    let falloff = 0.5 - x * x - y * y - z * z;
    if (falloff <= 0) return 0;
    falloff *= falloff;
    return falloff * falloff * Noise.grad3(hash, x, y, z);
  }

  private static grad2(hash: number, x: number, y: number) {
    const index = (hash & 7) * 2;
    return GRAD2[index] * x + GRAD2[index + 1] * y;
  }
  private static grad3(hash: number, x: number, y: number, z: number) {
    const index = (hash % 12) * 3;
    return GRAD3[index] * x + GRAD3[index + 1] * y + GRAD3[index + 2] * z;
  }

  private static distance(
    x: number,
    y: number,
    z: number,
    metric: WorleyMetric,
  ) {
    if (metric === "manhattan") return Math.abs(x) + Math.abs(y) + Math.abs(z);
    if (metric === "chebyshev")
      return Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
    return Math.sqrt(x * x + y * y + z * z);
  }
  private static worleyOutput(f1: number, f2: number, output: WorleyOutput) {
    if (output === "f1") return f1;
    if (output === "f2") return f2;
    return f2 - f1;
  }
}
