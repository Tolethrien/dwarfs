import AxiomMath from "@axiom/math";
import Noise from "@axiom/noise";
import SeededRandom from "@axiom/seedRandom";
import { BlocksID } from "../content/blocks";
import { STRUCTURES } from "../content/structures";
import { craterCenter } from "../world/shaftShape";
import type World from "../world/world";

interface DepthPoint {
  depth: number;
  amount: number;
}

// depth: amount by depth in tiles, linear between the points, flat past the ends; seam: flat beds
// from stretched noise, coverage = share of rock at amount 1; vein: crooked cracks walked tile by tile;
// nest: small lumps; perThousand: veins / nests per 1000 rock tiles at amount 1
export const ORES = {
  coal: {
    block: BlocksID.coal,
    depth: [
      { depth: 0, amount: 0 },
      { depth: 30, amount: 1 },
      { depth: 300, amount: 1 },
      { depth: 900, amount: 0.15 },
      { depth: 1280, amount: 0.1 },
    ],
    seam: { coverage: 0.06, frequency: 0.06, stretch: 6 },
  },
  iron: {
    block: BlocksID.iron,
    depth: [
      { depth: 20, amount: 1 },
      { depth: 300, amount: 1 },
      { depth: 700, amount: 0.35 },
      { depth: 1280, amount: 0.25 },
    ],
    vein: { perThousand: 4, length: { min: 6, max: 14 }, width: { min: 1, max: 2 }, turn: 0.6 },
  },
  fossils: {
    block: BlocksID.fossils,
    depth: [
      { depth: 140, amount: 0 },
      { depth: 150, amount: 0.1 },
      { depth: 500, amount: 0.5 },
      { depth: 1280, amount: 1 },
    ],
    nest: { perThousand: 2, size: { min: 2, max: 5 } },
  },
  // single lumps grown into cave walls: chance per wall tile; an ore may show up to lookAhead tiles
  // above its own depth, the rarer it is here, the likelier
  walls: { chance: 0.004, size: { min: 3, max: 6 }, lookAhead: 150, minWeight: 0.05 },
  // guaranteed seams of coal and iron beside the first crater, one on each side in random order,
  // filling the caves they cross; offset of their middles from the crater's middle, radius in tiles,
  // tilt leans their tops outwards, edge frayed by jag
  starter: { offset: { x: 16, y: 7 }, radius: { x: 8, y: 11 }, tilt: 0.35, jag: 0.35, frequency: 0.25 },
};

const HOSTS = new Set([
  BlocksID.sandstone,
  BlocksID.stone,
  BlocksID.granite,
  BlocksID.slate,
  BlocksID.gneiss,
  BlocksID.marble,
  BlocksID.ice,
  BlocksID.moss,
]);

const SALT = { coal: 1200, iron: 6, fossils: 7, walls: 8, starter: 9 };
const BAND_ROWS = 16;

const SIDES = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function placeOres(world: World, seed: number) {
  const noise = new Noise(seed);
  placeSeams(world, noise);
  placeVeins(world, new SeededRandom(SeededRandom.derive(seed, SALT.iron)));
  placeNests(world, new SeededRandom(SeededRandom.derive(seed, SALT.fossils)));
  placeWallNests(world, new SeededRandom(SeededRandom.derive(seed, SALT.walls)));
  placeStarterSeams(world, noise, new SeededRandom(SeededRandom.derive(seed, SALT.starter)));
}

function placeStarterSeams(world: World, noise: Noise, random: SeededRandom) {
  const starter = ORES.starter;
  const center = craterCenter(world, STRUCTURES.shaft.startDepth);
  const blocks = random.next() < 0.5 ? [ORES.iron.block, ORES.coal.block] : [ORES.coal.block, ORES.iron.block];
  blocks.forEach((block, index) => {
    const side = index === 0 ? -1 : 1;
    const middle = { x: center.x + side * starter.offset.x, y: center.y + starter.offset.y };
    placeStarterSeam(world, noise, middle, side, block, SALT.starter + index * 100);
  });
}

function placeStarterSeam(world: World, noise: Noise, middle: Position2D, side: number, block: BlocksID, salt: number) {
  const starter = ORES.starter;
  const sin = Math.sin(starter.tilt);
  const cos = Math.cos(starter.tilt);
  const reach = Math.ceil(Math.max(starter.radius.x, starter.radius.y) * (1 + starter.jag));
  for (let gy = Math.floor(middle.y) - reach; gy <= Math.floor(middle.y) + reach; gy++)
    for (let gx = Math.floor(middle.x) - reach; gx <= Math.floor(middle.x) + reach; gx++) {
      const dx = gx + 0.5 - middle.x;
      const dy = gy + 0.5 - middle.y;
      const across = (cos * dx + side * sin * dy) / starter.radius.x;
      const along = (cos * dy - side * sin * dx) / starter.radius.y;
      const edge = 1 + starter.jag * noise.simplex2D(gx * starter.frequency + salt, gy * starter.frequency);
      if (Math.hypot(across, along) > edge) continue;
      if (isHost(world, gx, gy) || world.getType(gx, gy) === BlocksID.air) world.setTile(gx, gy, block, world.getLook(gx, gy));
    }
}

function placeSeams(world: World, noise: Noise) {
  const coal = ORES.coal;
  const seam = coal.seam;
  for (let gy = 0; gy < world.mapInTiles.height; gy++) {
    const coverage = seam.coverage * amountAt(coal.depth, gy);
    if (coverage <= 0) continue;
    for (let gx = 0; gx < world.mapInTiles.width; gx++) {
      if (!isHost(world, gx, gy)) continue;
      const value = noise.fractal2D((gx * seam.frequency) / seam.stretch + SALT.coal, gy * seam.frequency, { octaves: 2 });
      if (AxiomMath.inverseLerp(-0.5, 0.5, value) > 1 - coverage) world.setTile(gx, gy, coal.block, world.getLook(gx, gy));
    }
  }
}

function placeVeins(world: World, random: SeededRandom) {
  const iron = ORES.iron;
  const vein = iron.vein;
  forEachBand(world, random, iron.depth, vein.perThousand, (start) => {
    const length = random.int(vein.length.min, vein.length.max);
    const width = random.int(vein.width.min, vein.width.max);
    const position = { x: start.x, y: start.y };
    let angle = random.float(0, Math.PI * 2);
    for (let step = 0; step < length; step++) {
      const gx = Math.round(position.x);
      const gy = Math.round(position.y);
      setOre(world, gx, gy, iron.block);
      if (width > 1) setOre(world, gx + Math.round(-Math.sin(angle)), gy + Math.round(Math.cos(angle)), iron.block);
      angle += random.float(-vein.turn, vein.turn);
      position.x += Math.cos(angle);
      position.y += Math.sin(angle);
    }
  });
}

function placeNests(world: World, random: SeededRandom) {
  const fossils = ORES.fossils;
  forEachBand(world, random, fossils.depth, fossils.nest.perThousand, (start) =>
    growNest(world, random, start, random.int(fossils.nest.size.min, fossils.nest.size.max), fossils.block),
  );
}

// rows in bands; each band gets its share of starts from the rock it holds and the depth's amount
function forEachBand(world: World, random: SeededRandom, depth: DepthPoint[], perThousand: number, place: (start: Position2D) => void) {
  const width = world.mapInTiles.width;
  for (let top = 0; top < world.mapInTiles.height; top += BAND_ROWS) {
    const bottom = Math.min(top + BAND_ROWS, world.mapInTiles.height);
    const amount = amountAt(depth, (top + bottom) / 2);
    if (amount <= 0) continue;
    const expected = (width * (bottom - top) * perThousand * amount) / 1000;
    const count = Math.floor(expected) + (random.next() < expected % 1 ? 1 : 0);
    for (let placed = 0; placed < count; placed++) {
      const start = { x: random.int(0, width - 1), y: random.int(top, bottom - 1) };
      if (isHost(world, start.x, start.y)) place(start);
    }
  }
}

function placeWallNests(world: World, random: SeededRandom) {
  const walls = ORES.walls;
  const ores = [ORES.coal, ORES.iron, ORES.fossils];
  for (let gy = 0; gy < world.mapInTiles.height; gy++)
    for (let gx = 0; gx < world.mapInTiles.width; gx++) {
      if (!isHost(world, gx, gy) || !touchesAir(world, gx, gy)) continue;
      if (random.next() >= walls.chance) continue;
      const weights = ores.map((ore) => wallWeight(ore.depth, gy));
      if (weights.every((weight) => weight === 0)) continue;
      const ore = random.weightedRandom(ores, weights);
      growNest(world, random, { x: gx, y: gy }, random.int(walls.size.min, walls.size.max), ore.block);
    }
}

function wallWeight(depth: DepthPoint[], gy: number) {
  const walls = ORES.walls;
  const start = depth.find((point) => point.amount > 0)?.depth ?? Infinity;
  if (gy < start - walls.lookAhead) return 0;
  const most = Math.max(...depth.map((point) => point.amount));
  return Math.max(walls.minWeight, 1 - amountAt(depth, gy) / most);
}

// a lump grows from the start, each step onto a rock tile next to one it already took
function growNest(world: World, random: SeededRandom, start: Position2D, size: number, block: BlocksID) {
  const taken = [start];
  setOre(world, start.x, start.y, block);
  for (let tries = 0; taken.length < size && tries < size * 4; tries++) {
    const from = taken[random.arrayIndex(taken)];
    const side = SIDES[random.arrayIndex(SIDES)];
    const next = { x: from.x + side.x, y: from.y + side.y };
    if (!isHost(world, next.x, next.y)) continue;
    setOre(world, next.x, next.y, block);
    taken.push(next);
  }
}

function amountAt(depth: DepthPoint[], gy: number) {
  if (gy <= depth[0].depth) return depth[0].amount;
  for (let index = 1; index < depth.length; index++) {
    const point = depth[index];
    if (gy > point.depth) continue;
    const previous = depth[index - 1];
    return AxiomMath.lerp(previous.amount, point.amount, AxiomMath.inverseLerp(previous.depth, point.depth, gy));
  }
  return depth[depth.length - 1].amount;
}

function isHost(world: World, gx: number, gy: number) {
  return HOSTS.has(world.getType(gx, gy));
}

function touchesAir(world: World, gx: number, gy: number) {
  return SIDES.some((side) => world.getType(gx + side.x, gy + side.y) === BlocksID.air);
}

function setOre(world: World, gx: number, gy: number, block: BlocksID) {
  if (isHost(world, gx, gy)) world.setTile(gx, gy, block, world.getLook(gx, gy));
}
