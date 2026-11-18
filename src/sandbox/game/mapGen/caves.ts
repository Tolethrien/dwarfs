import AxiomMath from "@axiom/math";
import Noise from "@axiom/noise";
import SeededRandom from "@axiom/seedRandom";
import { BlocksID } from "../content/blocks";
import { BiomesID } from "../content/biomes";
import type World from "../world/world";

interface TunnelLook {
  length: { min: number; max: number };
  width: { min: number; max: number };
}

// coverage: the share of rock turned into chambers in each of the map's equal horizontal bands, from
// the top down; frequency: the chambers' noise at the top and the bottom, lower is bigger chambers;
// kinds: regions of the map with their own chamber shape, stretch = width / height, share = part of
// the map; blend: how much of the region noise's range two kinds mix over at their border
export const CAVES = {
  chambers: {
    coverage: [0.07, 0.1, 0.13, 0.16],
    frequency: { top: 0.016, bottom: 0.009 },
    warp: 1.5,
    kinds: [
      { share: 0.75, stretch: 2.2 },
      { share: 0.15, stretch: 1 },
      { share: 0.1, stretch: 0.45 },
    ],
    kindFrequency: 0.006,
    blend: 0.04,
  },
  tunnels: {
    perBand: [
      { min: 8, max: 10 },
      { min: 6, max: 8 },
      { min: 5, max: 7 },
      { min: 3, max: 5 },
    ],
    length: { min: 40, max: 120 },
    width: { min: 3, max: 7 },
    wobble: 0.3,
    turn: 0.5,
    turnFrequency: 0.08,
    attempts: 20,
  },
  // a biome's own tunnels on top of the common caves, started and kept inside its area
  biomes: {
    [BiomesID.overgrown]: { count: 60, length: { min: 15, max: 40 }, width: { min: 3, max: 4 } },
  } as Partial<Record<BiomesID, TunnelLook & { count: number }>>,
  smoothing: 3,
  minWidth: 1,
  minArea: 60,
  minRockArea: 12,
};

const SALT = { kinds: 500, chambers: 600, tunnels: 3, biomeTunnels: 5 };
const HISTOGRAM_BINS = 1024;

const NEIGHBOURS = {
  four: [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ],
  eight: [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
  ],
};

// works on its own open / rock grid, the world only gets air at the end; rock: tiles a cave may take
class CaveGrid {
  readonly size: Size2D;
  readonly rock: Uint8Array;
  open: Uint8Array;

  constructor(world: World) {
    this.size = world.mapInTiles;
    this.rock = new Uint8Array(world.totalTiles);
    this.open = new Uint8Array(world.totalTiles);
    for (let gy = 0; gy < this.size.height; gy++)
      for (let gx = 0; gx < this.size.width; gx++) {
        const type = world.getType(gx, gy);
        const takes = type !== BlocksID.void && type !== BlocksID.obsidian && type !== BlocksID.dirt;
        if (takes) this.rock[gx + gy * this.size.width] = 1;
      }
  }

  takes(gx: number, gy: number) {
    return gx >= 0 && gy >= 0 && gx < this.size.width && gy < this.size.height && this.rock[gx + gy * this.size.width] === 1;
  }

  isOpen(gx: number, gy: number) {
    return this.takes(gx, gy) && this.open[gx + gy * this.size.width] === 1;
  }
}

export function carveCaves(world: World, seed: number) {
  const noise = new Noise(seed);
  const grid = new CaveGrid(world);
  carveChambers(grid, noise);
  carveTunnels(grid, noise, new SeededRandom(SeededRandom.derive(seed, SALT.tunnels)));
  carveBiomeTunnels(world, grid, noise, new SeededRandom(SeededRandom.derive(seed, SALT.biomeTunnels)));
  for (let pass = 0; pass < CAVES.smoothing; pass++) smooth(grid);
  if (CAVES.minWidth > 0) removeNarrow(grid, CAVES.minWidth);
  removeSmall(grid, 1, CAVES.minArea);
  removeSmall(grid, 0, CAVES.minRockArea);
  for (let gy = 0; gy < grid.size.height; gy++)
    for (let gx = 0; gx < grid.size.width; gx++) if (grid.isOpen(gx, gy)) world.setTile(gx, gy, BlocksID.air);
}

// the threshold per band comes from the coverage, so the share of air is set directly instead of
// guessing a noise level; blended between the bands' middles, so no seam shows at a band's edge
function carveChambers(grid: CaveGrid, noise: Noise) {
  const width = grid.size.width;
  const height = grid.size.height;
  const coverage = CAVES.chambers.coverage;
  const bandHeight = height / coverage.length;
  const field = new Float32Array(width * height);
  const histograms = coverage.map(() => new Uint32Array(HISTOGRAM_BINS));
  for (let gy = 0; gy < height; gy++) {
    const band = Math.min(Math.floor(gy / bandHeight), coverage.length - 1);
    for (let gx = 0; gx < width; gx++) {
      if (!grid.takes(gx, gy)) continue;
      const value = chamberValue(noise, gx, gy, height);
      field[gx + gy * width] = value;
      histograms[band][Math.min(Math.floor(value * HISTOGRAM_BINS), HISTOGRAM_BINS - 1)]++;
    }
  }
  const thresholds = histograms.map((histogram, band) => thresholdFor(histogram, coverage[band]));
  for (let gy = 0; gy < height; gy++) {
    const along = AxiomMath.clamp(gy / bandHeight - 0.5, 0, coverage.length - 1);
    const below = Math.floor(along);
    const threshold = AxiomMath.lerp(thresholds[below], thresholds[Math.min(below + 1, coverage.length - 1)], along - below);
    for (let gx = 0; gx < width; gx++) {
      const index = gx + gy * width;
      if (grid.rock[index] === 1 && field[index] > threshold) grid.open[index] = 1;
    }
  }
}

// the vertical coordinate is the integral of the frequency, so the scale changes with depth
// without stretching the chambers
function chamberValue(noise: Noise, gx: number, gy: number, height: number) {
  const chambers = CAVES.chambers;
  const top = chambers.frequency.top;
  const bottom = chambers.frequency.bottom;
  const x = gx * AxiomMath.lerp(top, bottom, gy / height);
  const y = top * gy + ((bottom - top) * gy * gy) / (2 * height);
  const region = noise01(noise.fractal2D(gx * chambers.kindFrequency + SALT.kinds, gy * chambers.kindFrequency, { octaves: 2 }));
  let value = 0;
  let from = 0;
  for (let kind = 0; kind < chambers.kinds.length; kind++) {
    const to = from + chambers.kinds[kind].share;
    const enter = kind === 0 ? 1 : AxiomMath.smoothstep(from - chambers.blend, from + chambers.blend, region);
    const leave = kind === chambers.kinds.length - 1 ? 0 : AxiomMath.smoothstep(to - chambers.blend, to + chambers.blend, region);
    const weight = enter * (1 - leave);
    from = to;
    if (weight <= 0) continue;
    const squash = Math.sqrt(chambers.kinds[kind].stretch);
    const sample = noise.warp2D(x / squash + SALT.chambers * (kind + 1), y * squash, chambers.warp, { octaves: 3 });
    value += weight * noise01(sample);
  }
  return value;
}

function thresholdFor(histogram: Uint32Array, coverage: number) {
  const total = histogram.reduce((sum, count) => sum + count, 0);
  let above = 0;
  for (let bin = HISTOGRAM_BINS - 1; bin >= 0; bin--) {
    above += histogram[bin];
    if (above >= total * coverage) return bin / HISTOGRAM_BINS;
  }
  return 0;
}

function carveTunnels(grid: CaveGrid, noise: Noise, random: SeededRandom) {
  const tunnels = CAVES.tunnels;
  const bandHeight = grid.size.height / tunnels.perBand.length;
  tunnels.perBand.forEach((count, band) => {
    const wanted = random.int(count.min, count.max);
    for (let tunnel = 0; tunnel < wanted; tunnel++)
      for (let attempt = 0; attempt < tunnels.attempts; attempt++) {
        const start = { x: random.int(0, grid.size.width - 1), y: random.int(Math.floor(band * bandHeight), Math.floor((band + 1) * bandHeight) - 1) };
        if (!grid.takes(start.x, start.y)) continue;
        carveTunnel(grid, noise, random, start, tunnels, () => true);
        break;
      }
  });
}

function carveBiomeTunnels(world: World, grid: CaveGrid, noise: Noise, random: SeededRandom) {
  world.biomeAreas.forEach((area, id) => {
    const look = CAVES.biomes[area.biome];
    if (look === undefined) return;
    const tiles: Position2D[] = [];
    for (let gy = 0; gy < grid.size.height; gy++)
      for (let gx = 0; gx < grid.size.width; gx++)
        if (world.getBiomeArea(gx, gy) === id && grid.takes(gx, gy)) tiles.push({ x: gx, y: gy });
    if (tiles.length === 0) return;
    const inside = (gx: number, gy: number) => world.getBiomeArea(gx, gy) === id;
    for (let tunnel = 0; tunnel < look.count; tunnel++) carveTunnel(grid, noise, random, tiles[random.arrayIndex(tiles)], look, inside);
  });
}

function carveTunnel(
  grid: CaveGrid,
  noise: Noise,
  random: SeededRandom,
  start: Position2D,
  look: TunnelLook,
  inside: (gx: number, gy: number) => boolean,
) {
  const tunnels = CAVES.tunnels;
  const length = random.int(look.length.min, look.length.max);
  const baseRadius = random.float(look.width.min, look.width.max) / 2;
  const offset = random.float(0, 1000);
  const position = { x: start.x, y: start.y };
  let angle = random.float(0, Math.PI * 2);
  for (let step = 0; step < length; step++) {
    const radius = Math.max(1.5, baseRadius * (1 + tunnels.wobble * noise.perlin1D(step * 0.1 + offset + 50)));
    openCircle(grid, position, radius, inside);
    angle += noise.perlin1D(step * tunnels.turnFrequency + offset) * tunnels.turn;
    position.x += Math.cos(angle);
    position.y += Math.sin(angle);
  }
}

function openCircle(grid: CaveGrid, center: Position2D, radius: number, inside: (gx: number, gy: number) => boolean) {
  const reach = Math.ceil(radius);
  const centerX = Math.round(center.x);
  const centerY = Math.round(center.y);
  for (let dy = -reach; dy <= reach; dy++)
    for (let dx = -reach; dx <= reach; dx++)
      if (dx * dx + dy * dy <= radius * radius && grid.takes(centerX + dx, centerY + dy) && inside(centerX + dx, centerY + dy))
        grid.open[centerX + dx + (centerY + dy) * grid.size.width] = 1;
}

// cellular automaton 4/5: more than 4 rock neighbours closes a tile, fewer opens it
function smooth(grid: CaveGrid) {
  const width = grid.size.width;
  const next = new Uint8Array(grid.open);
  for (let gy = 0; gy < grid.size.height; gy++)
    for (let gx = 0; gx < width; gx++) {
      if (!grid.takes(gx, gy)) continue;
      let walls = 0;
      for (const neighbour of NEIGHBOURS.eight) if (!grid.isOpen(gx + neighbour.x, gy + neighbour.y)) walls++;
      if (walls > 4) next[gx + gy * width] = 0;
      else if (walls < 4) next[gx + gy * width] = 1;
    }
  grid.open = next;
}

// erode then grow the air back: every passage narrower than 2 * radius + 1 closes
function removeNarrow(grid: CaveGrid, radius: number) {
  const width = grid.size.width;
  const height = grid.size.height;
  const eroded = new Uint8Array(grid.open.length);
  for (let gy = 0; gy < height; gy++)
    for (let gx = 0; gx < width; gx++) {
      if (!grid.isOpen(gx, gy)) continue;
      let whole = true;
      for (let dy = -radius; dy <= radius && whole; dy++)
        for (let dx = -radius; dx <= radius && whole; dx++) if (!grid.isOpen(gx + dx, gy + dy)) whole = false;
      if (whole) eroded[gx + gy * width] = 1;
    }
  const grown = new Uint8Array(grid.open.length);
  for (let gy = 0; gy < height; gy++)
    for (let gx = 0; gx < width; gx++) {
      if (eroded[gx + gy * width] !== 1) continue;
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) if (grid.takes(gx + dx, gy + dy)) grown[gx + dx + (gy + dy) * width] = 1;
    }
  grid.open = grown;
}

// flips regions of one kind smaller than minArea; a rock region touching anything a cave can't take
// (obsidian, dirt) belongs to the main rock and always stays
function removeSmall(grid: CaveGrid, kind: number, minArea: number) {
  const width = grid.size.width;
  const seen = new Uint8Array(grid.open.length);
  const queue = new Int32Array(grid.open.length);
  for (let start = 0; start < grid.open.length; start++) {
    if (seen[start] === 1 || grid.rock[start] !== 1 || grid.open[start] !== kind) continue;
    let head = 0;
    let tail = 0;
    let anchored = false;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const index = queue[head++];
      const gx = index % width;
      const gy = Math.floor(index / width);
      for (const neighbour of NEIGHBOURS.four) {
        const nx = gx + neighbour.x;
        const ny = gy + neighbour.y;
        if (!grid.takes(nx, ny)) {
          anchored = true;
          continue;
        }
        const next = nx + ny * width;
        if (seen[next] === 1 || grid.open[next] !== kind) continue;
        seen[next] = 1;
        queue[tail++] = next;
      }
    }
    if (tail >= minArea || (kind === 0 && anchored)) continue;
    for (let index = 0; index < tail; index++) grid.open[queue[index]] = kind === 1 ? 0 : 1;
  }
}

// fbm rarely leaves -0.5..0.5, so stretching that range spreads the values evenly over 0..1
function noise01(value: number) {
  return AxiomMath.clamp(AxiomMath.inverseLerp(-0.5, 0.5, value), 0, 1);
}
