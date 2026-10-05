import Noise from "@axiom/noise";
import SeededRandom from "@axiom/seedRandom";
import { BlocksID, BONES, ROCK } from "../content/blocks";
import { packTile, type Tile } from "../world/tile";
import World from "../world/world";
import GenContext, { type PassTools } from "./context";
import { shapePass, type ShapeConfig } from "./passes/shape";
import { layerAt, rockPass, type RockConfig } from "./passes/rock";
import { cavesPass, type CavesConfig } from "./passes/caves";
import { veinsPass, type VeinConfig } from "./passes/veins";
import {
  craterPass,
  type CraterArea,
  type CraterConfig,
} from "./passes/crater";
import { chestsPass, type ChestsConfig } from "./passes/chests";
import { decosPass, type DecosConfig } from "./passes/decos";

export interface MapGenConfig {
  tileInPixels: Size2D;
  chunkInTiles: Size2D;
  mapInChunks: Size2D;
  start: Position2D;
  biomeCellInTiles: number;
  border: Tile;
  placeholder: Tile;
  passes: {
    fill: boolean;
    rock: boolean;
    caves: boolean;
    veins: boolean;
    crater: boolean;
    chests: boolean;
    decos: boolean;
  };
  shape: ShapeConfig;
  rock: RockConfig;
  caves: CavesConfig;
  veins: readonly VeinConfig[];
  crater: CraterConfig;
  chests: ChestsConfig;
  decos: DecosConfig;
}

export const MAP_GEN_CONFIG: MapGenConfig = {
  tileInPixels: { width: 96, height: 96 },
  chunkInTiles: { width: 32, height: 32 },
  mapInChunks: { width: 10, height: 30 },
  start: { x: 0, y: 0 },
  biomeCellInTiles: 8,
  border: BlocksID.obsidian,
  placeholder: packTile(BlocksID.rock, ROCK.brown),
  passes: {
    fill: true,
    rock: true,
    caves: true,
    veins: true,
    crater: true,
    chests: true,
    decos: true,
  },
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
        perBand: [
          [1, 2],
          [2, 3],
          [3, 4],
          [5, 6],
        ],
        length: [30, 80],
        width: [6, 14],
        turn: 0.12,
        tip: 1.2,
      },
      spikes: {
        perBand: [[30, 40]],
        length: [5, 7],
        width: [2, 4],
        turn: 0.05,
        tip: 0.7,
      },
    },
    islands: {
      perBand: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 5],
      ],
      radius: [4, 8],
      clearance: 4,
    },
  },
  rock: {
    layers: [
      {
        until: 0.33,
        rocks: [
          packTile(BlocksID.rock, ROCK.lightBrown),
          packTile(BlocksID.rock, ROCK.brown),
        ],
      },
      {
        until: 0.66,
        rocks: [
          packTile(BlocksID.rock, ROCK.lightGray),
          packTile(BlocksID.rock, ROCK.gray),
        ],
      },
      {
        until: 1,
        rocks: [
          packTile(BlocksID.rock, ROCK.gray),
          packTile(BlocksID.rock, ROCK.darkGray),
        ],
      },
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
      perBand: [
        [8, 10],
        [6, 8],
        [5, 7],
        [3, 5],
      ],
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
    {
      type: BlocksID.coal,
      shape: "seam",
      perChunk: 0.45,
      depth: [0, 0.6],
      size: [3, 6],
      density: 1,
      wallBias: 0,
      district: 0.3,
    },
    {
      type: BlocksID.copper,
      shape: "vein",
      perChunk: 0.5,
      depth: [0.1, 0.55],
      size: [8, 16],
      density: 0.85,
      wallBias: 0.2,
      district: 0.7,
    },
    {
      type: packTile(BlocksID.bones, BONES.one),
      shape: "cluster",
      perChunk: 0.4,
      depth: [0.1, 0.7],
      size: [1, 3],
      density: 0.8,
      wallBias: 0.5,
      district: 0.5,
    },
    {
      type: packTile(BlocksID.bones, BONES.two),
      shape: "cluster",
      perChunk: 0.3,
      depth: [0.2, 0.8],
      size: [1, 3],
      density: 0.8,
      wallBias: 0.5,
      district: 0.5,
    },
    {
      type: BlocksID.silver,
      shape: "vein",
      perChunk: 0.5,
      depth: [0.3, 0.9],
      size: [10, 20],
      density: 0.85,
      wallBias: 0.2,
      district: 0.7,
    },
    {
      type: BlocksID.gold,
      shape: "vein",
      perChunk: 0.3,
      depth: [0.5, 1],
      size: [6, 12],
      density: 0.75,
      wallBias: 0.4,
      district: 0.8,
    },
    {
      type: BlocksID.sapphire,
      shape: "cluster",
      perChunk: 0.25,
      depth: [0.6, 1],
      size: [1, 2],
      density: 0.6,
      wallBias: 0.6,
      district: 0.8,
    },
    {
      type: BlocksID.diamonds,
      shape: "geode",
      perChunk: 0.08,
      depth: [0.8, 1],
      size: [2, 4],
      density: 0.6,
      wallBias: 0.7,
      district: 0.5,
      shell: packTile(BlocksID.rock, ROCK.lightGray),
    },
  ],
  crater: {
    chunk: 3,
    shaft: { width: 3, depth: 14 },
    radius: { width: 9, height: 6 },
    roughness: 0.25,
    cracks: { count: [4, 7], length: [5, 12] },
    rubble: { count: [2, 3], type: packTile(BlocksID.rock, ROCK.brown) },
    coal: { count: [1, 2], radius: [2, 3], type: BlocksID.coal },
  },
  chests: {
    spacing: 55,
    searchRadius: 6,
    fallbackChance: 0.5,
    nearStart: [2, 4],
  },
  decos: {
    mushroom: { chance: 0.08, depth: [0, 0.6] },
    stalactite: { chance: 0.1, depth: [0.2, 1] },
    moss: { chance: 0.06, depth: [0, 0.5] },
    chains: { chance: 0.12, depth: [0.3, 1] },
    torch: { chance: 0.04, depth: [0, 1] },
  },
};

const PASS_SALT = {
  shape: 1,
  rock: 2,
  caves: 3,
  veins: 4,
  crater: 5,
  chests: 6,
  decos: 7,
} as const;

export function generateMap(
  seed: number,
  config: MapGenConfig = MAP_GEN_CONFIG,
): World {
  const world = new World({
    meta: {
      seed,
      origin: { ...config.start },
      tileInPixels: { ...config.tileInPixels },
      chunkInTiles: { ...config.chunkInTiles },
      mapInChunks: { ...config.mapInChunks },
      biomeCellInTiles: config.biomeCellInTiles,
      border: config.border,
    },
  });
  const ctx = new GenContext(world.solid, world.mapInTiles, config.border);
  const tools = (pass: keyof typeof PASS_SALT): PassTools => {
    const passSeed = SeededRandom.derive(seed, PASS_SALT[pass]);
    return { random: new SeededRandom(passSeed), noise: new Noise(passSeed) };
  };

  // without fill the mine is empty air, only the obsidian band shows
  const fill = config.passes.fill ? config.placeholder : BlocksID.air;
  shapePass(ctx, config.shape, fill, tools("shape"));
  if (config.passes.rock) rockPass(ctx, config.rock, tools("rock"));
  if (config.passes.caves) cavesPass(ctx, config.caves, tools("caves"));
  if (config.passes.veins)
    veinsPass(ctx, config.veins, world.totalChunks, tools("veins"));
  const crater = config.passes.crater
    ? craterPass(ctx, config.crater, config, tools("crater"))
    : null;
  if (config.passes.chests)
    chestsPass(ctx, config.chests, crater, tools("chests"));
  // last: decos stand on the final rock
  if (config.passes.decos)
    decosPass(ctx, config.decos, world.decos, tools("decos"));

  fillBiomes(world, config);
  discoverStart(world, config, crater);
  return world;
}

// for now only the rock layer at the cell's depth
function fillBiomes(world: World, config: MapGenConfig) {
  const cell = config.biomeCellInTiles;
  for (let by = 0; by < world.biomeGrid.height; by++) {
    const depth = ((by + 0.5) * cell) / world.mapInTiles.height;
    const biome = layerAt(config.rock.layers, depth);
    world.biomes.fill(
      biome,
      by * world.biomeGrid.width,
      (by + 1) * world.biomeGrid.width,
    );
  }
}

function discoverStart(
  world: World,
  config: MapGenConfig,
  crater: CraterArea | null,
) {
  if (!crater) {
    world.setDiscovered(config.crater.chunk);
    return;
  }
  const chunkInTiles = config.chunkInTiles;
  const from = {
    x: Math.max(0, Math.floor(crater.bounds.min.x / chunkInTiles.width)),
    y: Math.max(0, Math.floor(crater.bounds.min.y / chunkInTiles.height)),
  };
  const to = {
    x: Math.min(
      config.mapInChunks.width - 1,
      Math.floor(crater.bounds.max.x / chunkInTiles.width),
    ),
    y: Math.min(
      config.mapInChunks.height - 1,
      Math.floor(crater.bounds.max.y / chunkInTiles.height),
    ),
  };
  for (let cy = from.y; cy <= to.y; cy++)
    for (let cx = from.x; cx <= to.x; cx++)
      world.setDiscovered(world.chunkIndex(cx, cy));
}
