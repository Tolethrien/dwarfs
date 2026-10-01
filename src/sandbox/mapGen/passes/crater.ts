import AxiomMath from "@axiom/math";
import { BlocksID } from "../../content/blocks";
import type { Tile } from "../../world/tile";
import type GenContext from "../context";
import type { PassTools, Range } from "../context";
import type { MapGenConfig } from "../mapGenerator";

export interface CraterConfig {
  chunk: number;
  shaft: { width: number; depth: number };
  radius: Size2D;
  roughness: number;
  cracks: { count: Range; length: Range };
  rubble: { count: Range; type: Tile };
  coal: { count: Range; radius: Range; type: Tile };
}

export interface CraterArea {
  center: Position2D;
  radius: number;
  bounds: BoxAABB;
}

const TUNING = {
  // lower edge of the shaft sits this far into the crater (fraction of its height)
  shaftOverlap: 0.5,
  edgeFrequency: 1.5,
  // cracks never go up into the shaft: from slightly above horizontal on the right, through down, to the left
  crackAngle: { min: -0.25, max: Math.PI + 0.25 },
  crackTurn: 0.35,
  rubbleSpread: 0.6,
  coalAngle: { min: 0.1, max: Math.PI - 0.1 },
};

export function craterPass(
  ctx: GenContext,
  config: CraterConfig,
  meta: Pick<MapGenConfig, "mapInChunks" | "chunkInTiles">,
  tools: PassTools,
): CraterArea {
  const random = tools.random;
  const chunk = {
    x: config.chunk % meta.mapInChunks.width,
    y: Math.floor(config.chunk / meta.mapInChunks.width),
  };
  const shaft = {
    x: chunk.x * meta.chunkInTiles.width + Math.floor(meta.chunkInTiles.width / 2),
    top: chunk.y * meta.chunkInTiles.height,
    half: Math.floor(config.shaft.width / 2),
  };
  const shaftBottom = shaft.top + config.shaft.depth;
  const center = {
    x: shaft.x,
    y: shaftBottom + Math.round(config.radius.height * TUNING.shaftOverlap),
  };

  const edge = (angle: number) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const ellipse =
      (config.radius.width * config.radius.height) /
      Math.hypot(config.radius.height * cos, config.radius.width * sin);
    const rough = tools.noise.fractal2D(
      cos * TUNING.edgeFrequency + 10,
      sin * TUNING.edgeFrequency + 10,
      { octaves: 3 },
    );
    return ellipse * (1 + config.roughness * rough);
  };

  // ---- shaft: a drill leaves clean, straight walls ----
  for (let gy = shaft.top; gy <= shaftBottom; gy++)
    for (let dx = -shaft.half; dx <= shaft.half; dx++)
      ctx.set(shaft.x + dx, gy, BlocksID.air);

  // ---- blast chamber ----
  const maxRadius =
    Math.max(config.radius.width, config.radius.height) * (1 + config.roughness);
  const blastReach = Math.ceil(maxRadius);

  for (let dy = -blastReach; dy <= blastReach; dy++)
    for (let dx = -blastReach; dx <= blastReach; dx++)
      if (Math.hypot(dx, dy) <= edge(Math.atan2(dy, dx)))
        ctx.set(center.x + dx, center.y + dy, BlocksID.air);

  // ---- cracks: thin, tapering, never up into the shaft ----
  const crackCount = random.int(config.cracks.count[0], config.cracks.count[1]);
  let crackReach = 0;

  for (let index = 0; index < crackCount; index++) {
    let angle = random.float(TUNING.crackAngle.min, TUNING.crackAngle.max);
    const length = random.int(config.cracks.length[0], config.cracks.length[1]);
    const start = edge(angle) - 1;
    const position = {
      x: center.x + Math.cos(angle) * start,
      y: center.y + Math.sin(angle) * start,
    };
    crackReach = Math.max(crackReach, start + length);

    for (let step = 0; step < length; step++) {
      const progress = step / length;
      angle += tools.noise.perlin1D(step * 0.3 + index * 50) * TUNING.crackTurn;
      position.x += Math.cos(angle);
      position.y += Math.sin(angle);
      ctx.stamp(position, AxiomMath.lerp(1, 0.5, progress), BlocksID.air);
    }
  }

  // ---- coal the blast uncovered in the lower walls ----
  const coalCount = random.int(config.coal.count[0], config.coal.count[1]);
  for (let index = 0; index < coalCount; index++) {
    const angle = random.float(TUNING.coalAngle.min, TUNING.coalAngle.max);
    const radius = random.int(config.coal.radius[0], config.coal.radius[1]);
    const distance = edge(angle) + radius * 0.5;
    ctx.stamp(
      {
        x: center.x + Math.cos(angle) * distance,
        y: center.y + Math.sin(angle) * distance,
      },
      radius,
      config.coal.type,
      (gx, gy) => ctx.isGround(gx, gy),
    );
  }

  // ---- rubble, kept out of the shaft column ----
  const rubbleCount = random.int(config.rubble.count[0], config.rubble.count[1]);
  for (let index = 0; index < rubbleCount; index++) {
    const angle = random.float(0, Math.PI * 2);
    const distance = random.float(0, TUNING.rubbleSpread) * edge(angle);
    const gx = Math.round(center.x + Math.cos(angle) * distance);
    const gy = Math.round(center.y + Math.sin(angle) * distance);
    if (Math.abs(gx - shaft.x) <= shaft.half + 1) continue;
    if (ctx.isAir(gx, gy)) ctx.set(gx, gy, config.rubble.type);
  }

  const reach = Math.ceil(Math.max(maxRadius, crackReach + 1));
  return {
    center,
    radius: Math.max(config.radius.width, config.radius.height),
    bounds: {
      min: { x: Math.min(shaft.x - shaft.half, center.x - reach), y: shaft.top },
      max: { x: Math.max(shaft.x + shaft.half, center.x + reach), y: center.y + reach },
    },
  };
}
