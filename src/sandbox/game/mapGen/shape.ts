import AxiomMath from "@axiom/math";
import Noise from "@axiom/noise";
import SeededRandom from "@axiom/seedRandom";
import { STRUCTURES } from "../content/structures";

export enum ShapeTile {
  void,
  map,
  obsidian,
}

// margin: the map's distance from the world's side and bottom edges, the band and the void live in it;
// band: obsidian around everything that isn't the map, min always, up to max where the noise says so
export const SHAPE = {
  top: 2,
  margin: { min: 3, base: 4, wave: 2, frequency: 0.04 },
  band: { min: 2, max: 3, frequency: 0.3 },
  // the shaft's column down the middle, nothing unbreakable may reach into it (with its obsidian
  // band): margin is the free rock left on each side of the shaft
  shaftLane: { margin: 10 },
  // perBand: spikes in each of the map's equal horizontal bands, from the top down; reach: how far
  // into the width a side spike may go, so the middle (the shaft) stays free
  spikes: {
    sides: {
      perBand: [
        { min: 1, max: 2 },
        { min: 2, max: 3 },
        { min: 3, max: 4 },
        { min: 4, max: 5 },
      ],
      length: { min: 40, max: 120 },
      width: { min: 10, max: 24 },
    },
    bottom: { count: { min: 3, max: 5 }, length: { min: 60, max: 200 }, width: { min: 16, max: 30 } },
    tip: 1,
    turn: 0.1,
    spread: 0.5,
    wobble: 0.2,
    reach: 0.4,
    safeTop: 48,
  },
  islands: {
    perBand: [
      { min: 1, max: 2 },
      { min: 2, max: 3 },
      { min: 3, max: 4 },
      { min: 4, max: 6 },
    ],
    radius: { min: 4, max: 9 },
    roughness: 0.35,
    edgeFrequency: 1.3,
    clearance: 6,
    attempts: 20,
  },
};

const SALT = { left: 1000, right: 2000, bottom: 3000, band: 700, spikes: 1, islands: 2 };

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

type Side = "left" | "right" | "bottom";

class ShapeGrid {
  readonly size: Size2D;
  readonly tiles: Uint8Array;

  constructor(size: Size2D) {
    this.size = size;
    this.tiles = new Uint8Array(size.width * size.height);
  }

  inside(gx: number, gy: number) {
    return gx >= 0 && gy >= 0 && gx < this.size.width && gy < this.size.height;
  }

  isMap(gx: number, gy: number) {
    return this.inside(gx, gy) && this.tiles[gx + gy * this.size.width] === ShapeTile.map;
  }

  set(gx: number, gy: number, tile: ShapeTile) {
    if (this.inside(gx, gy)) this.tiles[gx + gy * this.size.width] = tile;
  }
}

export function generateShape(size: Size2D, seed: number) {
  const noise = new Noise(seed);
  const grid = new ShapeGrid(size);
  outline(grid, noise);
  const spikesRandom = new SeededRandom(SeededRandom.derive(seed, SALT.spikes));
  carveSideSpikes(grid, noise, spikesRandom);
  carveBottomSpikes(grid, noise, spikesRandom);
  carveIslands(grid, noise, new SeededRandom(SeededRandom.derive(seed, SALT.islands)));
  keepLargestRegion(grid);
  buildBand(grid, noise);
  return grid.tiles;
}

function outline(grid: ShapeGrid, noise: Noise) {
  const width = grid.size.width;
  const height = grid.size.height;
  const bottom = new Int32Array(width);
  for (let gx = 0; gx < width; gx++) bottom[gx] = marginAt(noise, gx, SALT.bottom);
  for (let gy = SHAPE.top; gy < height; gy++) {
    const left = marginAt(noise, gy, SALT.left);
    const right = marginAt(noise, gy, SALT.right);
    for (let gx = left; gx < width - right; gx++) if (gy < height - bottom[gx]) grid.set(gx, gy, ShapeTile.map);
  }
}

function marginAt(noise: Noise, along: number, salt: number) {
  const margin = SHAPE.margin;
  return Math.max(margin.min, Math.round(margin.base + margin.wave * noise.fractal1D((along + salt) * margin.frequency, { octaves: 3 })));
}

function carveSideSpikes(grid: ShapeGrid, noise: Noise, random: SeededRandom) {
  const spikes = SHAPE.spikes;
  const bandHeight = grid.size.height / spikes.sides.perBand.length;
  spikes.sides.perBand.forEach((count, band) => {
    const from = Math.max(spikes.safeTop, Math.floor(band * bandHeight));
    const to = Math.floor((band + 1) * bandHeight) - 1;
    const wanted = random.int(count.min, count.max);
    for (let spike = 0; spike < wanted; spike++) {
      const side = random.bool() ? "left" : "right";
      const gy = random.int(from, to);
      let gx = 0;
      while (gx < grid.size.width && !grid.isMap(side === "left" ? gx : grid.size.width - 1 - gx, gy)) gx++;
      const start = side === "left" ? { x: gx - 1, y: gy } : { x: grid.size.width - gx, y: gy };
      carveSpike(grid, noise, random, side, start, side === "left" ? 0 : Math.PI, spikes.sides);
    }
  });
}

function carveBottomSpikes(grid: ShapeGrid, noise: Noise, random: SeededRandom) {
  const bottom = SHAPE.spikes.bottom;
  const wanted = random.int(bottom.count.min, bottom.count.max);
  for (let spike = 0; spike < wanted; spike++) {
    const middle = grid.size.width / 2;
    const lane = laneHalfWidth();
    const gx = Math.floor(random.bool() ? random.float(grid.size.width * 0.1, middle - lane) : random.float(middle + lane, grid.size.width * 0.9));
    let gy = grid.size.height - 1;
    while (gy > 0 && !grid.isMap(gx, gy)) gy--;
    carveSpike(grid, noise, random, "bottom", { x: gx, y: gy + 1 }, -Math.PI / 2, bottom);
  }
}

// a cone from the edge into the map: wide at the base, a slow bend and a wobbling outline
function carveSpike(
  grid: ShapeGrid,
  noise: Noise,
  random: SeededRandom,
  side: Side,
  start: Position2D,
  inward: number,
  look: { length: { min: number; max: number }; width: { min: number; max: number } },
) {
  const spikes = SHAPE.spikes;
  const width = grid.size.width;
  const length = random.int(look.length.min, look.length.max);
  const baseRadius = random.float(look.width.min, look.width.max) / 2;
  const offset = random.float(0, 1000);
  const position = { x: start.x, y: start.y };
  let angle = inward + random.float(-spikes.spread, spikes.spread);
  for (let step = 0; step < length; step++) {
    const radius = AxiomMath.lerp(baseRadius, spikes.tip, step / length) * (1 + spikes.wobble * noise.perlin1D(step * 0.2 + offset + 50));
    const tooFar =
      position.y < spikes.safeTop ||
      inShaftLane(grid, position.x, radius) ||
      (side === "left" && position.x > width * spikes.reach) ||
      (side === "right" && position.x < width * (1 - spikes.reach));
    if (tooFar) return;
    carveCircle(grid, position, radius);
    angle += noise.perlin1D(step * 0.08 + offset) * spikes.turn;
    position.x += Math.cos(angle);
    position.y += Math.sin(angle);
  }
}

function carveCircle(grid: ShapeGrid, center: Position2D, radius: number) {
  const reach = Math.ceil(radius);
  const centerX = Math.round(center.x);
  const centerY = Math.round(center.y);
  for (let dy = -reach; dy <= reach; dy++)
    for (let dx = -reach; dx <= reach; dx++) if (dx * dx + dy * dy <= radius * radius) grid.set(centerX + dx, centerY + dy, ShapeTile.void);
}

// holes in the map, the band then rings them with obsidian
function carveIslands(grid: ShapeGrid, noise: Noise, random: SeededRandom) {
  const islands = SHAPE.islands;
  const bandHeight = grid.size.height / islands.perBand.length;
  islands.perBand.forEach((count, band) => {
    const from = Math.max(SHAPE.spikes.safeTop, Math.floor(band * bandHeight));
    const to = Math.floor((band + 1) * bandHeight) - 1;
    const wanted = random.int(count.min, count.max);
    for (let island = 0; island < wanted; island++)
      for (let attempt = 0; attempt < islands.attempts; attempt++) {
        const center = { x: random.int(0, grid.size.width - 1), y: random.int(from, to) };
        const radius = random.float(islands.radius.min, islands.radius.max);
        const reach = Math.ceil(radius * (1 + islands.roughness));
        if (inShaftLane(grid, center.x, reach)) continue;
        if (!hasRoom(grid, center, reach + islands.clearance)) continue;
        const offset = random.float(0, 1000);
        for (let dy = -reach; dy <= reach; dy++)
          for (let dx = -reach; dx <= reach; dx++) {
            const angle = Math.atan2(dy, dx);
            const edgeX = Math.cos(angle) * islands.edgeFrequency + offset;
            const edgeY = Math.sin(angle) * islands.edgeFrequency;
            const edge = radius * (1 + islands.roughness * noise.fractal2D(edgeX, edgeY, { octaves: 2 }));
            if (Math.hypot(dx, dy) <= edge) grid.set(center.x + dx, center.y + dy, ShapeTile.void);
          }
        break;
      }
  });
}

function inShaftLane(grid: ShapeGrid, gx: number, reach: number) {
  return Math.abs(gx - grid.size.width / 2) < reach + laneHalfWidth();
}

function laneHalfWidth() {
  return STRUCTURES.shaft.width / 2 + SHAPE.shaftLane.margin + SHAPE.band.max;
}

function hasRoom(grid: ShapeGrid, center: Position2D, reach: number) {
  for (let dy = -reach; dy <= reach; dy++)
    for (let dx = -reach; dx <= reach; dx++) if (!grid.isMap(center.x + dx, center.y + dy)) return false;
  return true;
}

// a pocket the spikes cut off could never be reached, it turns into void
function keepLargestRegion(grid: ShapeGrid) {
  const width = grid.size.width;
  const tiles = grid.tiles;
  const region = new Int32Array(tiles.length).fill(-1);
  const queue = new Int32Array(tiles.length);
  const sizes: number[] = [];
  for (let start = 0; start < tiles.length; start++) {
    if (tiles[start] !== ShapeTile.map || region[start] !== -1) continue;
    const label = sizes.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    region[start] = label;
    while (head < tail) {
      const index = queue[head++];
      const gx = index % width;
      const gy = Math.floor(index / width);
      for (const neighbour of NEIGHBOURS.four) {
        if (!grid.isMap(gx + neighbour.x, gy + neighbour.y)) continue;
        const next = index + neighbour.x + neighbour.y * width;
        if (region[next] !== -1) continue;
        region[next] = label;
        queue[tail++] = next;
      }
    }
    sizes.push(tail);
  }
  const largest = sizes.indexOf(Math.max(...sizes));
  for (let index = 0; index < tiles.length; index++) if (tiles[index] === ShapeTile.map && region[index] !== largest) tiles[index] = ShapeTile.void;
}

// distance from the map over 8 neighbours, so the band has no diagonal gap a ball could slip through
function buildBand(grid: ShapeGrid, noise: Noise) {
  const band = SHAPE.band;
  const width = grid.size.width;
  const tiles = grid.tiles;
  const distance = new Uint8Array(tiles.length);
  const queue = new Int32Array(tiles.length);
  let head = 0;
  let tail = 0;
  for (let index = 0; index < tiles.length; index++) if (tiles[index] === ShapeTile.map) queue[tail++] = index;
  while (head < tail) {
    const index = queue[head++];
    const step = tiles[index] === ShapeTile.map ? 0 : distance[index];
    if (step >= band.max) continue;
    const gx = index % width;
    const gy = Math.floor(index / width);
    for (const neighbour of NEIGHBOURS.eight) {
      if (!grid.inside(gx + neighbour.x, gy + neighbour.y)) continue;
      const next = index + neighbour.x + neighbour.y * width;
      if (tiles[next] === ShapeTile.map || distance[next] !== 0) continue;
      distance[next] = step + 1;
      queue[tail++] = next;
    }
  }
  for (let index = 0; index < tiles.length; index++) {
    const step = distance[index];
    if (step === 0) continue;
    const gx = index % width;
    const gy = Math.floor(index / width);
    const thick = step <= band.min || noise.perlin2D(gx * band.frequency + SALT.band, gy * band.frequency) > 0;
    if (thick) tiles[index] = ShapeTile.obsidian;
  }
}
