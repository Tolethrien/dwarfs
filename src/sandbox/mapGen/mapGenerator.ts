import Noise from "@axiom/noise";
import SeededRandom from "@axiom/seedRandom";
import { BackgroundsID, BlocksID } from "../managers/entitiesObject";
import GenContext, { type PassTools } from "./context";
import { shapePass, type ShapeConfig } from "./passes/shape";
import { layerAt, rockPass, type RockConfig } from "./passes/rock";
import { cavesPass, type CavesConfig } from "./passes/caves";
import { veinsPass, type VeinConfig } from "./passes/veins";
import { craterPass, type CraterArea, type CraterConfig } from "./passes/crater";
import { chestsPass, type ChestsConfig } from "./passes/chests";

export interface MapGenConfig {
  tileInPixels: Size2D;
  chunkInTiles: Size2D;
  mapInChunks: Size2D;
  start: Position2D;
  border: BlocksID;
  placeholder: BlocksID;
  passes: {
    rock: boolean;
    caves: boolean;
    veins: boolean;
    crater: boolean;
    chests: boolean;
  };
  shape: ShapeConfig;
  rock: RockConfig;
  caves: CavesConfig;
  veins: readonly VeinConfig[];
  crater: CraterConfig;
  chests: ChestsConfig;
}

export interface MapMeta {
  start: Position2D;
  tileInPixels: Size2D;
  chunkInPixels: Size2D;
  chunkInTiles: Size2D;
  mapInPixels: Size2D;
  mapInTiles: Size2D;
  mapInChunks: Size2D;
  blocksPerChunk: number;
  totalBlocks: number;
  totalChunks: number;
}

export interface GeneratedMap {
  meta: MapMeta;
  background: Uint16Array;
  decoBack: Uint16Array;
  solid: Uint16Array;
  damage: Uint16Array;
  decoFront: Uint16Array;
  discovered: Uint8Array;
  biome: Uint8Array;
}

export const MAP_GEN_CONFIG: MapGenConfig = {
  tileInPixels: { width: 96, height: 96 },
  chunkInTiles: { width: 32, height: 32 },
  mapInChunks: { width: 10, height: 30 },
  start: { x: 0, y: 0 },
  border: BlocksID.obsidian,
  placeholder: BlocksID.rocksBrown,
  passes: { rock: true, caves: true, veins: true, crater: true, chests: true },
  shape: {
    margin: { min: 2, base: 3, amplitude: 2, frequency: 0.04 },
    teeth: { amplitude: 20, frequency: 0.015, threshold: 0.15 },
    corners: { size: 40, depth: 14 },
    top: 3,
    border: { min: 2, max: 3, frequency: 0.3 },
    ragged: { depth: 2.5, frequency: 0.2 },
    intrusions: {
      safeTop: 48,
      reach: 0.42,
      tongues: {
        perBand: [[1, 2], [2, 3], [3, 4], [5, 6]],
        length: [30, 80],
        width: [6, 14],
        turn: 0.12,
        tip: 1.2,
      },
      spikes: { perBand: [[30, 40]], length: [5, 7], width: [2, 4], turn: 0.05, tip: 0.7 },
    },
    islands: { perBand: [[0, 1], [1, 2], [2, 3], [3, 5]], radius: [4, 8], clearance: 4 },
  },
  rock: {
    layers: [
      { until: 0.33, rocks: [BlocksID.rocksLightBrown, BlocksID.rocksBrown] },
      { until: 0.66, rocks: [BlocksID.rocksLightGray, BlocksID.rocksGray] },
      { until: 1, rocks: [BlocksID.rocksGray, BlocksID.rocksDarkGray] },
    ],
    boundary: { warp: 40, frequency: 0.01 },
    patches: { frequency: 0.04 },
  },
  caves: {
    chambers: {
      coverage: [0.07, 0.1, 0.13, 0.16],
      frequency: [0.016, 0.009],
      stretch: 1.8,
      warp: 1.5,
    },
    tunnels: {
      perBand: [[8, 10], [6, 8], [5, 7], [3, 5]],
      length: [40, 120],
      radius: [1.5, 2.2],
      turn: 0.5,
      turnFrequency: 0.08,
    },
    smoothing: 3,
    minWidth: 1,
    minArea: 60,
    minRockArea: 12,
  },
  veins: [
    { type: BlocksID.coal, shape: "seam", perChunk: 0.45, depth: [0, 0.6], size: [3, 6], density: 1, wallBias: 0, district: 0.3 },
    { type: BlocksID.copper, shape: "vein", perChunk: 0.5, depth: [0.1, 0.55], size: [8, 16], density: 0.85, wallBias: 0.2, district: 0.7 },
    { type: BlocksID.bonesOne, shape: "cluster", perChunk: 0.4, depth: [0.1, 0.7], size: [1, 3], density: 0.8, wallBias: 0.5, district: 0.5 },
    { type: BlocksID.bonesTwo, shape: "cluster", perChunk: 0.3, depth: [0.2, 0.8], size: [1, 3], density: 0.8, wallBias: 0.5, district: 0.5 },
    { type: BlocksID.silver, shape: "vein", perChunk: 0.5, depth: [0.3, 0.9], size: [10, 20], density: 0.85, wallBias: 0.2, district: 0.7 },
    { type: BlocksID.gold, shape: "vein", perChunk: 0.3, depth: [0.5, 1], size: [6, 12], density: 0.75, wallBias: 0.4, district: 0.8 },
    { type: BlocksID.sapphire, shape: "cluster", perChunk: 0.25, depth: [0.6, 1], size: [1, 2], density: 0.6, wallBias: 0.6, district: 0.8 },
    { type: BlocksID.diamonds, shape: "geode", perChunk: 0.08, depth: [0.8, 1], size: [2, 4], density: 0.6, wallBias: 0.7, district: 0.5, shell: BlocksID.rocksLightGray },
  ],
  crater: {
    chunk: 3,
    shaft: { width: 3, depth: 14 },
    radius: { width: 9, height: 6 },
    roughness: 0.25,
    cracks: { count: [4, 7], length: [5, 12] },
    rubble: { count: [2, 3], type: BlocksID.rocksBrown },
    coal: { count: [1, 2], radius: [2, 3], type: BlocksID.coal },
  },
  chests: { spacing: 55, searchRadius: 6, fallbackChance: 0.5, nearStart: [2, 4] },
};

const PASS_SALT = {
  shape: 1,
  rock: 2,
  caves: 3,
  veins: 4,
  crater: 5,
  chests: 6,
  background: 7,
} as const;

const BACKGROUNDS = Object.values(BackgroundsID).filter(
  (value) => typeof value === "number" && value !== BackgroundsID.none,
) as BackgroundsID[];

export function chunkMajorIndex(meta: MapMeta, gx: number, gy: number) {
  const cx = Math.floor(gx / meta.chunkInTiles.width);
  const cy = Math.floor(gy / meta.chunkInTiles.height);
  const localIndex =
    (gy - cy * meta.chunkInTiles.height) * meta.chunkInTiles.width +
    (gx - cx * meta.chunkInTiles.width);
  return (cy * meta.mapInChunks.width + cx) * meta.blocksPerChunk + localIndex;
}

function buildMeta(config: MapGenConfig): MapMeta {
  const chunkInTiles = config.chunkInTiles;
  const mapInChunks = config.mapInChunks;
  const tileInPixels = config.tileInPixels;
  const mapInTiles = {
    width: mapInChunks.width * chunkInTiles.width,
    height: mapInChunks.height * chunkInTiles.height,
  };
  const blocksPerChunk = chunkInTiles.width * chunkInTiles.height;
  const totalChunks = mapInChunks.width * mapInChunks.height;

  return {
    start: { ...config.start },
    tileInPixels: { ...tileInPixels },
    chunkInPixels: {
      width: chunkInTiles.width * tileInPixels.width,
      height: chunkInTiles.height * tileInPixels.height,
    },
    chunkInTiles: { ...chunkInTiles },
    mapInPixels: {
      width: mapInTiles.width * tileInPixels.width,
      height: mapInTiles.height * tileInPixels.height,
    },
    mapInTiles,
    mapInChunks: { ...mapInChunks },
    blocksPerChunk,
    totalBlocks: blocksPerChunk * totalChunks,
    totalChunks,
  };
}

export function generateMap(
  seed: number,
  config: MapGenConfig = MAP_GEN_CONFIG,
): GeneratedMap {
  const meta = buildMeta(config);
  const ctx = new GenContext(meta.mapInTiles, config.border);
  const tools = (pass: keyof typeof PASS_SALT): PassTools => {
    const passSeed = SeededRandom.derive(seed, PASS_SALT[pass]);
    return { random: new SeededRandom(passSeed), noise: new Noise(passSeed) };
  };

  shapePass(ctx, config.shape, config.placeholder, tools("shape"));
  if (config.passes.rock) rockPass(ctx, config.rock, tools("rock"));
  if (config.passes.caves)
    cavesPass(ctx, config.caves, tools("caves"));
  if (config.passes.veins)
    veinsPass(ctx, config.veins, meta.totalChunks, tools("veins"));
  const crater = config.passes.crater
    ? craterPass(ctx, config.crater, meta, tools("crater"))
    : null;
  if (config.passes.chests)
    chestsPass(ctx, config.chests, crater, tools("chests"));

  return finish(ctx, config, meta, crater, tools("background"));
}

// the row-major work grid goes to the chunk-major layout; outside the mask only what the shape pass left (band or void)
function finish(
  ctx: GenContext,
  config: MapGenConfig,
  meta: MapMeta,
  crater: CraterArea | null,
  tools: PassTools,
): GeneratedMap {
  const map: GeneratedMap = {
    meta,
    background: new Uint16Array(meta.totalBlocks),
    decoBack: new Uint16Array(meta.totalBlocks),
    solid: new Uint16Array(meta.totalBlocks),
    damage: new Uint16Array(meta.totalBlocks),
    decoFront: new Uint16Array(meta.totalBlocks),
    discovered: new Uint8Array(meta.totalChunks),
    biome: new Uint8Array(meta.totalChunks),
  };

  for (let gy = 0; gy < ctx.height; gy++) {
    for (let gx = 0; gx < ctx.width; gx++) {
      const source = ctx.index(gx, gy);
      const target = chunkMajorIndex(meta, gx, gy);
      map.solid[target] = ctx.solid[source];
      map.background[target] = ctx.mask[source] === 1
        ? BACKGROUNDS[tools.random.arrayIndex(BACKGROUNDS)]
        : BackgroundsID.none;
    }
  }

  for (let chunkIndex = 0; chunkIndex < meta.totalChunks; chunkIndex++) {
    const cy = Math.floor(chunkIndex / meta.mapInChunks.width);
    const depth = ((cy + 0.5) * meta.chunkInTiles.height) / ctx.height;
    map.biome[chunkIndex] = layerAt(config.rock.layers, depth);
  }

  if (crater) {
    const from = {
      x: Math.max(0, Math.floor(crater.bounds.min.x / meta.chunkInTiles.width)),
      y: Math.max(0, Math.floor(crater.bounds.min.y / meta.chunkInTiles.height)),
    };
    const to = {
      x: Math.min(meta.mapInChunks.width - 1, Math.floor(crater.bounds.max.x / meta.chunkInTiles.width)),
      y: Math.min(meta.mapInChunks.height - 1, Math.floor(crater.bounds.max.y / meta.chunkInTiles.height)),
    };
    for (let cy = from.y; cy <= to.y; cy++)
      for (let cx = from.x; cx <= to.x; cx++)
        map.discovered[cy * meta.mapInChunks.width + cx] = 1;
  } else {
    map.discovered[config.crater.chunk] = 1;
  }

  return map;
}
