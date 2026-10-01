import AxiomMath from "@axiom/math";
import Noise from "@axiom/noise";
import { BlocksID } from "../../content/blocks";
import type GenContext from "../context";
import { NEIGHBOURS, type PassTools, type Range } from "../context";

export interface CavesConfig {
  chambers: {
    coverage: readonly number[];
    frequency: Range;
    stretch: number;
    warp: number;
  };
  tunnels: {
    perBand: readonly Range[];
    length: Range;
    radius: Range;
    turn: number;
    turnFrequency: number;
  };
  smoothing: number;
  minWidth: number;
  minArea: number;
  minRockArea: number;
}

const CHAMBER_STEP = 3;
// cells of the open/closed grid
const CELL = { open: 1, closed: 0 };

// works on its own open/closed grid, so a tile the smoothing fills back keeps its rock type
export function cavesPass(ctx: GenContext, config: CavesConfig, tools: PassTools) {
  const open = new Uint8Array(ctx.width * ctx.height);

  carveChambers(ctx, open, config, tools);
  carveTunnels(ctx, open, config, tools);
  for (let pass = 0; pass < config.smoothing; pass++) smooth(ctx, open);
  if (config.minWidth > 0) removeNarrow(ctx, open, config.minWidth);
  removeSmall(ctx, open, CELL.open, config.minArea);
  removeSmall(ctx, open, CELL.closed, config.minRockArea);

  for (let index = 0; index < open.length; index++)
    if (open[index] === CELL.open && ctx.mask[index] === 1)
      ctx.solid[index] = BlocksID.air;
}

// the threshold comes from the coverage, so the share of air is set directly instead of guessing a noise level;
// one threshold per band, blended between band centres so no seam shows at a band edge
function carveChambers(
  ctx: GenContext,
  open: Uint8Array,
  config: CavesConfig,
  tools: PassTools,
) {
  const chambers = config.chambers;
  const frequencyAt = { top: chambers.frequency[0], bottom: chambers.frequency[1] };
  // the vertical coordinate is the integral of the frequency, so the scale changes with depth without stretching
  const field = Noise.sampleGrid(
    { width: ctx.width, height: ctx.height },
    CHAMBER_STEP,
    (gx, gy) => {
      const frequency = AxiomMath.lerp(frequencyAt.top, frequencyAt.bottom, gy / ctx.height);
      const vertical =
        frequencyAt.top * gy +
        ((frequencyAt.bottom - frequencyAt.top) * gy * gy) / (2 * ctx.height);
      return tools.noise.warp2D(
        (gx * frequency) / chambers.stretch,
        vertical,
        chambers.warp,
        { octaves: 3 },
      );
    },
  );

  const bands = chambers.coverage.length;
  const bandHeight = ctx.height / bands;
  const thresholds = chambers.coverage.map((coverage, band) => {
    const from = Math.floor(band * bandHeight) * ctx.width;
    const to = Math.floor((band + 1) * bandHeight) * ctx.width;
    const samples = new Float32Array(to - from);
    let count = 0;
    for (let index = from; index < to; index++)
      if (ctx.mask[index] === 1) samples[count++] = field[index];
    if (count === 0) return Infinity;
    const sorted = samples.subarray(0, count).sort();
    return sorted[Math.floor((1 - coverage) * (count - 1))];
  });

  for (let gy = 0; gy < ctx.height; gy++) {
    const position = AxiomMath.clamp((gy + 0.5) / bandHeight - 0.5, 0, bands - 1);
    const lower = Math.floor(position);
    const upper = Math.min(lower + 1, bands - 1);
    const threshold = AxiomMath.lerp(thresholds[lower], thresholds[upper], position - lower);

    for (let gx = 0; gx < ctx.width; gx++) {
      const index = ctx.index(gx, gy);
      if (ctx.mask[index] === 1 && field[index] > threshold) open[index] = CELL.open;
    }
  }
}

function carveTunnels(
  ctx: GenContext,
  open: Uint8Array,
  config: CavesConfig,
  tools: PassTools,
) {
  const tunnels = config.tunnels;
  const random = tools.random;
  const bandHeight = ctx.height / tunnels.perBand.length;
  const starts: Position2D[] = [];

  tunnels.perBand.forEach((range, band) => {
    const count = random.int(range[0], range[1]);
    for (let index = 0; index < count; index++)
      starts.push({
        x: random.int(0, ctx.width - 1),
        y: random.int(
          Math.floor(band * bandHeight),
          Math.floor((band + 1) * bandHeight) - 1,
        ),
      });
  });

  for (let tunnel = 0; tunnel < starts.length; tunnel++) {
    const position = { x: starts[tunnel].x, y: starts[tunnel].y };
    if (!ctx.playable(position.x, position.y)) continue;

    let angle = random.float(0, Math.PI * 2);
    const length = random.int(tunnels.length[0], tunnels.length[1]);
    const radius = random.float(tunnels.radius[0], tunnels.radius[1]);
    const reach = Math.ceil(radius);

    for (let step = 0; step < length; step++) {
      angle +=
        tools.noise.perlin1D(step * tunnels.turnFrequency + tunnel * 97.3) *
        tunnels.turn;
      position.x += Math.cos(angle);
      position.y += Math.sin(angle);
      const centerX = Math.round(position.x);
      const centerY = Math.round(position.y);
      if (!ctx.playable(centerX, centerY)) break;

      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue;
          if (ctx.playable(centerX + dx, centerY + dy))
            open[ctx.index(centerX + dx, centerY + dy)] = CELL.open;
        }
      }
    }
  }
}

// cellular automaton 4/5: turns a scattered edge into a hollowed out one
// hot path (every tile x 8 neighbours x passes): plain array reads instead of ctx calls; the mask never
// touches the array edge (walls are at least 1 tile), so the neighbours of a mask tile are always inside
function smooth(ctx: GenContext, open: Uint8Array) {
  const next = open.slice();
  const width = ctx.width;
  for (let index = 0; index < open.length; index++) {
    if (ctx.mask[index] !== 1) continue;

    const rock =
      8 -
      open[index - width - 1] -
      open[index - width] -
      open[index - width + 1] -
      open[index - 1] -
      open[index + 1] -
      open[index + width - 1] -
      open[index + width] -
      open[index + width + 1];

    if (rock >= 5) next[index] = CELL.closed;
    else if (rock <= 3) next[index] = CELL.open;
  }
  open.set(next);
}

// morphological opening: erode then dilate the air, every passage narrower than 2 * radius + 1 closes
// open is only ever set on mask tiles, so outside the mask it reads as rock without a mask check
function removeNarrow(ctx: GenContext, open: Uint8Array, radius: number) {
  const eroded = new Uint8Array(open.length);
  const width = ctx.width;
  const height = ctx.height;

  const allOpen = (gx: number, gy: number) => {
    if (gx < radius || gy < radius || gx >= width - radius || gy >= height - radius)
      return false;
    for (let y = gy - radius; y <= gy + radius; y++)
      for (let x = gx - radius; x <= gx + radius; x++)
        if (open[x + y * width] !== CELL.open) return false;
    return true;
  };
  const anyEroded = (gx: number, gy: number) => {
    for (let y = Math.max(0, gy - radius); y <= Math.min(height - 1, gy + radius); y++)
      for (let x = Math.max(0, gx - radius); x <= Math.min(width - 1, gx + radius); x++)
        if (eroded[x + y * width] === CELL.open) return true;
    return false;
  };

  for (let gy = 0; gy < height; gy++)
    for (let gx = 0; gx < width; gx++)
      if (open[gx + gy * width] === CELL.open && allOpen(gx, gy))
        eroded[gx + gy * width] = CELL.open;

  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const index = gx + gy * width;
      if (ctx.mask[index] === 1) open[index] = anyEroded(gx, gy) ? CELL.open : CELL.closed;
    }
  }
}

// flips regions smaller than minArea; a rock region touching the map edge is the main rock and always stays
function removeSmall(
  ctx: GenContext,
  open: Uint8Array,
  value: number,
  minArea: number,
) {
  const visited = new Uint8Array(open.length);
  const queue = new Int32Array(open.length);

  for (let start = 0; start < open.length; start++) {
    if (visited[start] || ctx.mask[start] !== 1 || open[start] !== value)
      continue;

    let head = 0;
    let tail = 0;
    let touchesEdge = false;
    queue[tail++] = start;
    visited[start] = 1;

    while (head < tail) {
      const index = queue[head++];
      const gx = index % ctx.width;
      const gy = Math.floor(index / ctx.width);

      for (const [dx, dy] of NEIGHBOURS.four) {
        if (!ctx.playable(gx + dx, gy + dy)) {
          touchesEdge = true;
          continue;
        }
        const next = ctx.index(gx + dx, gy + dy);
        if (visited[next] || open[next] !== value) continue;
        visited[next] = 1;
        queue[tail++] = next;
      }
    }

    const keep = tail >= minArea || (value === CELL.closed && touchesEdge);
    if (keep) continue;
    for (let index = 0; index < tail; index++)
      open[queue[index]] = value === CELL.open ? CELL.closed : CELL.open;
  }
}
