import AxiomMath from "@axiom/math";
import type { BlocksID } from "../../managers/entitiesObject";
import type GenContext from "../context";
import type { PassTools, Range } from "../context";

export interface IntrusionConfig {
  perBand: readonly Range[];
  length: Range;
  width: Range;
  turn: number;
  tip: number;
}

export interface ShapeConfig {
  margin: { min: number; base: number; amplitude: number; frequency: number };
  teeth: { amplitude: number; frequency: number; threshold: number };
  corners: { size: number; depth: number };
  top: number;
  border: { min: number; max: number; frequency: number };
  ragged: { depth: number; frequency: number };
  intrusions: {
    safeTop: number;
    reach: number;
    tongues: IntrusionConfig;
    spikes: IntrusionConfig;
  };
  islands: { perBand: readonly Range[]; radius: Range; clearance: number };
}

const EDGE_OFFSET = { left: 0, right: 1000, bottom: 2000 };
const INTRUSION = { wobble: 0.3, spread: 0.6, startOutside: 1 };
const ISLAND = { attempts: 20, roughness: 0.35, edgeFrequency: 1.3 };
const NEIGHBOURS_4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const NEIGHBOURS_8 = [
  ...NEIGHBOURS_4,
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

// the playable mask, a thin obsidian band hugging it, and void (air, never reachable) beyond the band
export function shapePass(
  ctx: GenContext,
  config: ShapeConfig,
  placeholder: BlocksID,
  tools: PassTools,
) {
  buildMask(ctx, config, placeholder, tools);
  carveIntrusions(ctx, config, config.intrusions.tongues, tools);
  carveIntrusions(ctx, config, config.intrusions.spikes, tools);
  carveIslands(ctx, config, tools);
  roughenEdge(ctx, config, tools);
  keepLargestRegion(ctx);
  buildBorder(ctx, config, tools);
}

function buildMask(
  ctx: GenContext,
  config: ShapeConfig,
  placeholder: BlocksID,
  tools: PassTools,
) {
  const thickness = (along: number, length: number, offset: number) => {
    const wave =
      config.margin.amplitude *
      tools.noise.fractal1D((along + offset) * config.margin.frequency, {
        octaves: 3,
      });
    const tooth = tools.noise.fractal1D(
      (along + offset) * config.teeth.frequency + 500,
      { octaves: 2 },
    );
    const bite =
      tooth > config.teeth.threshold
        ? (config.teeth.amplitude * (tooth - config.teeth.threshold)) /
          (1 - config.teeth.threshold)
        : 0;
    const fromCorner = Math.min(along, length - 1 - along);
    const corner =
      config.corners.depth *
      Math.pow(1 - AxiomMath.clamp(fromCorner / config.corners.size, 0, 1), 2);

    // at least 1: the caves pass reads the neighbours of mask tiles without a bounds check
    return Math.max(
      Math.max(1, config.margin.min),
      Math.round(config.margin.base + wave + bite + corner),
    );
  };

  const left = new Int32Array(ctx.height);
  const right = new Int32Array(ctx.height);
  const bottom = new Int32Array(ctx.width);

  for (let gy = 0; gy < ctx.height; gy++) {
    left[gy] = thickness(gy, ctx.height, EDGE_OFFSET.left);
    right[gy] = thickness(gy, ctx.height, EDGE_OFFSET.right);
  }
  for (let gx = 0; gx < ctx.width; gx++)
    bottom[gx] = thickness(gx, ctx.width, EDGE_OFFSET.bottom);

  for (let gy = 0; gy < ctx.height; gy++) {
    for (let gx = 0; gx < ctx.width; gx++) {
      const inside =
        gy >= Math.max(1, config.top) &&
        gx >= left[gy] &&
        gx < ctx.width - right[gy] &&
        gy < ctx.height - bottom[gx];
      if (!inside) continue;

      const index = ctx.index(gx, gy);
      ctx.mask[index] = 1;
      ctx.solid[index] = placeholder;
    }
  }
}

// obsidian tongues and spikes from the side and bottom edges, wide at the base and tapering;
// side ones stop before the middle, so the map never splits in two
function carveIntrusions(
  ctx: GenContext,
  config: ShapeConfig,
  intrusion: IntrusionConfig,
  tools: PassTools,
) {
  const limits = config.intrusions;
  const random = tools.random;
  const bandHeight = ctx.height / intrusion.perBand.length;
  const starts: { side: EdgeSide; start: EdgeStart }[] = [];

  intrusion.perBand.forEach((range, band) => {
    const rows = {
      from: Math.max(limits.safeTop, Math.floor(band * bandHeight)),
      to: Math.floor((band + 1) * bandHeight) - 1,
    };
    if (rows.from > rows.to) return;
    const lastBand = band === intrusion.perBand.length - 1;
    const edges: EdgeSide[] = lastBand ? ["left", "right", "bottom"] : ["left", "right"];
    const bandRows = rows.to - rows.from + 1;
    const weights = lastBand ? [bandRows, bandRows, ctx.width] : [bandRows, bandRows];

    const count = random.int(range[0], range[1]);
    for (let index = 0; index < count; index++) {
      const side = random.weightedRandom(edges, weights);
      const start = edgeStart(ctx, side, rows, random.next());
      if (start) starts.push({ side, start });
    }
  });

  for (const { side, start } of starts) {
    let angle = start.angle + random.float(-INTRUSION.spread, INTRUSION.spread);
    const length = random.int(intrusion.length[0], intrusion.length[1]);
    const baseRadius = random.float(intrusion.width[0], intrusion.width[1]) / 2;
    const offset = random.float(0, 1000);
    const position = { x: start.x, y: start.y };

    for (let step = 0; step < length; step++) {
      const progress = step / length;
      angle += tools.noise.perlin1D(step * 0.08 + offset) * intrusion.turn;
      position.x += Math.cos(angle);
      position.y += Math.sin(angle);

      const tooFar =
        position.y < limits.safeTop ||
        (side === "left" && position.x > ctx.width * limits.reach) ||
        (side === "right" && position.x < ctx.width * (1 - limits.reach));
      if (tooFar) break;

      const radius =
        AxiomMath.lerp(baseRadius, intrusion.tip, progress * progress) *
        (1 + INTRUSION.wobble * tools.noise.perlin1D(step * 0.2 + offset + 50));
      carveCircle(ctx, position, radius);
    }
  }
}

type EdgeSide = "left" | "right" | "bottom";
interface EdgeStart {
  x: number;
  y: number;
  angle: number;
}

// obsidian rings inside the map with void in the middle, never touching the edge or each other
function carveIslands(ctx: GenContext, config: ShapeConfig, tools: PassTools) {
  const random = tools.random;
  const bandHeight = ctx.height / config.islands.perBand.length;

  const hasRoom = (gx: number, gy: number, reach: number) => {
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++)
        if (!ctx.playable(gx + dx, gy + dy)) return false;
    return true;
  };

  config.islands.perBand.forEach((range, band) => {
    const rows = {
      from: Math.max(config.intrusions.safeTop, Math.floor(band * bandHeight)),
      to: Math.floor((band + 1) * bandHeight) - 1,
    };
    if (rows.from > rows.to) return;
    const count = random.int(range[0], range[1]);

    for (let island = 0; island < count; island++) {
      for (let attempt = 0; attempt < ISLAND.attempts; attempt++) {
        const center = {
          x: random.int(0, ctx.width - 1),
          y: random.int(rows.from, rows.to),
        };
        const radius = random.float(config.islands.radius[0], config.islands.radius[1]);
        const reach = Math.ceil(radius * (1 + ISLAND.roughness));
        if (!hasRoom(center.x, center.y, reach + config.islands.clearance)) continue;

        const offset = random.float(0, 1000);
        for (let dy = -reach; dy <= reach; dy++) {
          for (let dx = -reach; dx <= reach; dx++) {
            const angle = Math.atan2(dy, dx);
            const edge =
              radius *
              (1 +
                ISLAND.roughness *
                  tools.noise.fractal2D(
                    Math.cos(angle) * ISLAND.edgeFrequency + offset,
                    Math.sin(angle) * ISLAND.edgeFrequency,
                    { octaves: 2 },
                  ));
            if (Math.hypot(dx, dy) > edge) continue;
            const index = ctx.index(center.x + dx, center.y + dy);
            ctx.mask[index] = 0;
            ctx.solid[index] = 0;
          }
        }
        break;
      }
    }
  });
}

function edgeStart(
  ctx: GenContext,
  side: EdgeSide,
  rows: { from: number; to: number },
  roll: number,
): EdgeStart | null {
  if (side === "bottom") {
    const gx = Math.floor(AxiomMath.lerp(ctx.width * 0.1, ctx.width * 0.9, roll));
    for (let gy = ctx.height - 1; gy >= rows.from; gy--)
      if (ctx.mask[ctx.index(gx, gy)] === 1)
        return { x: gx, y: gy + INTRUSION.startOutside, angle: -Math.PI / 2 };
    return null;
  }

  const gy = Math.floor(AxiomMath.lerp(rows.from, rows.to, roll));
  for (let step = 0; step < ctx.width; step++) {
    const gx = side === "left" ? step : ctx.width - 1 - step;
    if (ctx.mask[ctx.index(gx, gy)] !== 1) continue;
    return side === "left"
      ? { x: gx - INTRUSION.startOutside, y: gy, angle: 0 }
      : { x: gx + INTRUSION.startOutside, y: gy, angle: Math.PI };
  }
  return null;
}

function carveCircle(ctx: GenContext, center: Position2D, radius: number) {
  const reach = Math.ceil(radius);
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const gx = Math.round(center.x) + dx;
      const gy = Math.round(center.y) + dy;
      if (!ctx.inside(gx, gy)) continue;
      const index = ctx.index(gx, gy);
      ctx.mask[index] = 0;
      ctx.solid[index] = 0;
    }
  }
}

// a smooth short wave along the edge instead of random bites: a mask tile closer to the edge than the
// local wave depth turns to obsidian
function roughenEdge(ctx: GenContext, config: ShapeConfig, tools: PassTools) {
  const maxDepth = Math.ceil(config.ragged.depth);
  if (maxDepth <= 0) return;
  const depth = new Uint8Array(ctx.mask.length);
  const queue = new Int32Array(ctx.mask.length);
  let head = 0;
  let tail = 0;

  for (let gy = 0; gy < ctx.height; gy++) {
    for (let gx = 0; gx < ctx.width; gx++) {
      const index = ctx.index(gx, gy);
      if (ctx.mask[index] !== 1) continue;
      if (NEIGHBOURS_4.some(([dx, dy]) => !ctx.playable(gx + dx, gy + dy))) {
        depth[index] = 1;
        queue[tail++] = index;
      }
    }
  }

  while (head < tail) {
    const index = queue[head++];
    if (depth[index] >= maxDepth) continue;
    const gx = index % ctx.width;
    const gy = Math.floor(index / ctx.width);
    for (const [dx, dy] of NEIGHBOURS_4) {
      if (!ctx.playable(gx + dx, gy + dy)) continue;
      const next = ctx.index(gx + dx, gy + dy);
      if (depth[next] !== 0) continue;
      depth[next] = depth[index] + 1;
      queue[tail++] = next;
    }
  }

  for (let gy = 0; gy < ctx.height; gy++) {
    for (let gx = 0; gx < ctx.width; gx++) {
      const index = ctx.index(gx, gy);
      if (depth[index] === 0) continue;
      const wave = AxiomMath.clamp(
        (tools.noise.perlin2D(
          gx * config.ragged.frequency + 900,
          gy * config.ragged.frequency,
        ) +
          1) /
          2,
        0,
        1,
      );
      if (depth[index] > config.ragged.depth * wave) continue;
      ctx.mask[index] = 0;
      ctx.solid[index] = 0;
    }
  }
}

// a pocket the tongues cut off could never be reached, it turns into void behind the band instead
function keepLargestRegion(ctx: GenContext) {
  const region = new Int32Array(ctx.mask.length).fill(-1);
  const queue = new Int32Array(ctx.mask.length);
  const sizes: number[] = [];

  for (let start = 0; start < ctx.mask.length; start++) {
    if (ctx.mask[start] !== 1 || region[start] !== -1) continue;
    const label = sizes.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    region[start] = label;

    while (head < tail) {
      const index = queue[head++];
      const gx = index % ctx.width;
      const gy = Math.floor(index / ctx.width);
      for (const [dx, dy] of NEIGHBOURS_4) {
        if (!ctx.inside(gx + dx, gy + dy)) continue;
        const next = ctx.index(gx + dx, gy + dy);
        if (ctx.mask[next] !== 1 || region[next] !== -1) continue;
        region[next] = label;
        queue[tail++] = next;
      }
    }
    sizes.push(tail);
  }

  const largest = sizes.indexOf(Math.max(...sizes));
  for (let index = 0; index < ctx.mask.length; index++) {
    if (ctx.mask[index] !== 1 || region[index] === largest) continue;
    ctx.mask[index] = 0;
    ctx.solid[index] = 0;
  }
}

// distance from the mask over 8 neighbours, so the band has no diagonal gap a ball could slip through
function buildBorder(ctx: GenContext, config: ShapeConfig, tools: PassTools) {
  const distance = new Uint8Array(ctx.width * ctx.height);
  const queue = new Int32Array(ctx.width * ctx.height);
  let head = 0;
  let tail = 0;

  for (let index = 0; index < ctx.mask.length; index++)
    if (ctx.mask[index] === 1) queue[tail++] = index;

  while (head < tail) {
    const index = queue[head++];
    const step = ctx.mask[index] === 1 ? 0 : distance[index];
    if (step >= config.border.max) continue;
    const gx = index % ctx.width;
    const gy = Math.floor(index / ctx.width);

    for (const [dx, dy] of NEIGHBOURS_8) {
      if (!ctx.inside(gx + dx, gy + dy)) continue;
      const next = ctx.index(gx + dx, gy + dy);
      if (ctx.mask[next] === 1 || distance[next] !== 0) continue;
      distance[next] = step + 1;
      queue[tail++] = next;
    }
  }

  for (let gy = 0; gy < ctx.height; gy++) {
    for (let gx = 0; gx < ctx.width; gx++) {
      const index = ctx.index(gx, gy);
      const step = distance[index];
      if (step === 0) continue;
      const thick =
        step <= config.border.min ||
        tools.noise.perlin2D(
          gx * config.border.frequency + 700,
          gy * config.border.frequency,
        ) > 0;
      if (thick) ctx.solid[index] = ctx.border;
    }
  }
}
