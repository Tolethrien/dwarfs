import AxiomMath from "@axiom/math";
import Noise from "@axiom/noise";
import SeededRandom from "@axiom/seedRandom";
import { BiomesID } from "../content/biomes";
import { BLOCKS, BlocksID } from "../content/blocks";
import { DECORATIONS, DecosID, type DecoSupport } from "../content/decorations";
import type World from "../world/world";

interface WeightedDeco {
  id: DecosID;
  weight: number;
}

interface BiomeDecoPool {
  chance: { floor: number; ceiling: number; wall: number; corner: number };
  mushroomShare: number;
  floor: WeightedDeco[];
  mushrooms: DecosID[];
  ceiling: WeightedDeco[];
  wall: DecosID[];
}

export const DECO_GEN = {
  salt: { random: 71, cluster: 701, species: 709 },
  clusterFreq: 0.08,
  speciesFreq: 0.025,
  scale: { min: 0.82, max: 1.12 },
  offset: 0.12,
  shallowDepth: 0.35,
};

const POOLS: Record<BiomesID, BiomeDecoPool> = {
  [BiomesID.none]: {
    chance: { floor: 0.28, ceiling: 0.22, wall: 0.12, corner: 0.24 },
    mushroomShare: 0.32,
    floor: [
      { id: DecosID.rubble, weight: 3 },
      { id: DecosID.stalagmiteTall, weight: 2 },
      { id: DecosID.stalagmiteWide, weight: 2 },
      { id: DecosID.quartzCluster, weight: 1.2 },
    ],
    mushrooms: [
      DecosID.mushroomsAmber,
      DecosID.mushroomsCyan,
      DecosID.mushroomsViolet,
      DecosID.mushroomsCrimson,
      DecosID.mushroomsBone,
    ],
    ceiling: [
      { id: DecosID.stalactites, weight: 4 },
      { id: DecosID.roots, weight: 1.5 },
      { id: DecosID.mossStrip, weight: 1 },
    ],
    wall: [DecosID.shelfMushroomsBrown, DecosID.shelfMushroomsRust, DecosID.shelfMushroomsBlue],
  },
  [BiomesID.overgrown]: {
    chance: { floor: 0.45, ceiling: 0.5, wall: 0.22, corner: 0.2 },
    mushroomShare: 0.72,
    floor: [
      { id: DecosID.rubble, weight: 2 },
      { id: DecosID.stalagmiteWide, weight: 1 },
    ],
    mushrooms: [
      DecosID.mushroomsEmerald,
      DecosID.mushroomsAmber,
      DecosID.mushroomsCyan,
      DecosID.mushroomsViolet,
    ],
    ceiling: [
      { id: DecosID.mossStrip, weight: 3.5 },
      { id: DecosID.vinesBuds, weight: 3 },
      { id: DecosID.roots, weight: 2.5 },
    ],
    wall: [DecosID.shelfMushroomsBrown, DecosID.shelfMushroomsRust],
  },
  [BiomesID.frozen]: {
    chance: { floor: 0.32, ceiling: 0.28, wall: 0.14, corner: 0.1 },
    mushroomShare: 0.3,
    floor: [
      { id: DecosID.quartzCluster, weight: 3.5 },
      { id: DecosID.stalagmiteTall, weight: 2.5 },
      { id: DecosID.stalagmiteWide, weight: 1.5 },
      { id: DecosID.rubble, weight: 1 },
    ],
    mushrooms: [DecosID.mushroomsCyan, DecosID.mushroomsViolet, DecosID.mushroomsBone],
    ceiling: [{ id: DecosID.stalactites, weight: 1 }],
    wall: [DecosID.shelfMushroomsBlue],
  },
};

export function placeDecorations(world: World, seed: number) {
  const noise = new Noise(seed);
  const random = new SeededRandom(SeededRandom.derive(seed, DECO_GEN.salt.random));
  const width = world.mapInTiles.width;
  const height = world.mapInTiles.height;

  for (let gy = 1; gy < height - 1; gy++) {
    const depth = gy / height;
    for (let gx = 1; gx < width - 1; gx++) {
      if (world.getType(gx, gy) !== BlocksID.air) continue;
      const solidUp = isSolid(world, gx, gy - 1);
      const solidDown = isSolid(world, gx, gy + 1);
      const solidLeft = isSolid(world, gx - 1, gy);
      const solidRight = isSolid(world, gx + 1, gy);
      if (!solidUp && !solidDown && !solidLeft && !solidRight) continue;

      const biome = world.biomeAreas[world.getBiomeArea(gx, gy)].biome;
      const pool = POOLS[biome];
      const cluster = noise01(noise.perlin2D(gx * DECO_GEN.clusterFreq + DECO_GEN.salt.cluster, gy * DECO_GEN.clusterFreq));
      const boost = AxiomMath.lerp(0.45, 1.55, cluster);

      let placedCorner = false;
      if (solidUp && (solidLeft || solidRight) && random.float(0, 1) < pool.chance.corner) {
        const support = pickSide(solidLeft, solidRight, random, "topLeft", "topRight");
        place(world, gx, gy, DecosID.cobweb, support, random);
        placedCorner = true;
      }

      if (solidDown && random.float(0, 1) < pool.chance.floor * boost) {
        const id =
          random.float(0, 1) < pool.mushroomShare
            ? pickSpecies(pool.mushrooms, noise, gx, gy)
            : pickWeighted(pool.floor, random);
        place(world, gx, gy, id, "floor", random);
      }

      if (solidUp && !placedCorner && random.float(0, 1) < pool.chance.ceiling * boost) {
        const id = pickCeiling(pool, biome, depth, random);
        place(world, gx, gy, id, "ceiling", random);
      }

      if ((solidLeft || solidRight) && !placedCorner && random.float(0, 1) < pool.chance.wall * boost) {
        const support = pickSide(solidLeft, solidRight, random, "left", "right");
        const id = pickSpecies(pool.wall, noise, gx, gy);
        place(world, gx, gy, id, support, random);
      }
    }
  }
}

function place(world: World, gx: number, gy: number, id: DecosID, support: DecoSupport, random: SeededRandom) {
  const data = DECORATIONS[id];
  const corner = support === "topLeft" || support === "topRight";
  const layer = random.float(0, 1) < data.frontChance ? "front" : "back";
  let flipX = false;
  if (support === "right" || support === "topRight") flipX = true;
  else if (support === "floor" || support === "ceiling") flipX = random.float(0, 1) < 0.5;

  world.addDeco(gx, gy, {
    id: id,
    layer: layer,
    support: support,
    flipX: flipX,
    scale: corner ? random.float(0.9, 1.05) : random.float(DECO_GEN.scale.min, DECO_GEN.scale.max),
    offset: corner ? 0 : random.float(-DECO_GEN.offset, DECO_GEN.offset),
    phase: random.float(0, 1000),
  });
}

function pickCeiling(pool: BiomeDecoPool, biome: BiomesID, depth: number, random: SeededRandom) {
  if (biome === BiomesID.none && depth > DECO_GEN.shallowDepth) return DecosID.stalactites;
  return pickWeighted(pool.ceiling, random);
}

function pickSide<T extends DecoSupport>(left: boolean, right: boolean, random: SeededRandom, leftValue: T, rightValue: T): T {
  if (left && right) return random.float(0, 1) < 0.5 ? leftValue : rightValue;
  return left ? leftValue : rightValue;
}

function pickSpecies(list: DecosID[], noise: Noise, gx: number, gy: number) {
  const share = noise01(noise.perlin2D(gx * DECO_GEN.speciesFreq + DECO_GEN.salt.species, gy * DECO_GEN.speciesFreq));
  return list[Math.min(Math.floor(share * list.length), list.length - 1)];
}

function pickWeighted(items: WeightedDeco[], random: SeededRandom) {
  let total = 0;
  for (const item of items) total += item.weight;
  let roll = random.float(0, total);
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item.id;
  }
  return items[items.length - 1].id;
}

function isSolid(world: World, gx: number, gy: number) {
  return BLOCKS[world.getType(gx, gy)].solid;
}

function noise01(value: number) {
  return AxiomMath.clamp(AxiomMath.inverseLerp(-0.5, 0.5, value), 0, 1);
}
