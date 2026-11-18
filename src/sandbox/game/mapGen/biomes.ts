import AxiomMath from "@axiom/math";
import Noise from "@axiom/noise";
import SeededRandom from "@axiom/seedRandom";
import { assert } from "@axiom/utils";
import { BlocksID } from "../content/blocks";
import { BIOMES, BiomesID } from "../content/biomes";
import type World from "../world/world";

// depth: the area's middle as a share of the map's height; across: where its middle may land as a
// share of the width; roughness: how far the outline swings in and out; warp: tiles the whole area
// is pushed around by, it grows the branches and bays; fill: the share of rock turned into the
// biome's blocks, in the middle and at the outline, decided in patches of the given noise frequency
export const BIOME_GEN = {
  areas: [
    { biome: BiomesID.overgrown, depth: 0.5, radius: { x: 70, y: 50 } },
    { biome: BiomesID.frozen, depth: 0.75, radius: { x: 70, y: 50 } },
  ],
  across: { min: 0.25, max: 0.75 },
  roughness: 0.45,
  edgeFrequency: 1.2,
  warp: { strength: 14, frequency: 0.03 },
  fill: { middle: 0.9, edge: 0.25, frequency: 0.12 },
};

const SALT = { random: 4, warpX: 800, warpY: 900, fill: 1100 };

export function placeBiomes(world: World, seed: number) {
  const noise = new Noise(seed);
  const random = new SeededRandom(SeededRandom.derive(seed, SALT.random));
  for (const area of BIOME_GEN.areas) {
    const data = BIOMES[area.biome];
    assert(data !== undefined, `biome ${BiomesID[area.biome]} has no data`);
    const center = {
      x: random.float(BIOME_GEN.across.min, BIOME_GEN.across.max) * world.mapInTiles.width,
      y: area.depth * world.mapInTiles.height,
    };
    const offset = random.float(0, 1000);
    const id = world.addBiomeArea({ biome: area.biome });
    const reach = {
      x: Math.ceil(area.radius.x * (1 + BIOME_GEN.roughness) + BIOME_GEN.warp.strength),
      y: Math.ceil(area.radius.y * (1 + BIOME_GEN.roughness) + BIOME_GEN.warp.strength),
    };
    for (let gy = Math.floor(center.y) - reach.y; gy <= Math.floor(center.y) + reach.y; gy++)
      for (let gx = Math.floor(center.x) - reach.x; gx <= Math.floor(center.x) + reach.x; gx++) {
        const type = world.getType(gx, gy);
        if (type === BlocksID.void || type === BlocksID.obsidian) continue;
        const out = outFromMiddle(noise, area.radius, center, offset, gx, gy);
        if (out > 1) continue;
        world.biomes[world.tileIndex(gx, gy)] = id;
        const replaced = data.replace[type];
        if (replaced !== undefined && isFilled(noise, gx, gy, offset, out)) world.setTile(gx, gy, replaced, world.getLook(gx, gy));
      }
  }
}

function isFilled(noise: Noise, gx: number, gy: number, offset: number, out: number) {
  const fill = BIOME_GEN.fill;
  const patch = AxiomMath.inverseLerp(-0.5, 0.5, noise.fractal2D(gx * fill.frequency + SALT.fill + offset, gy * fill.frequency, { octaves: 2 }));
  return patch > 1 - AxiomMath.lerp(fill.middle, fill.edge, out);
}

// 0 in the area's middle, 1 on its outline, more outside it
function outFromMiddle(noise: Noise, radius: Position2D, center: Position2D, offset: number, gx: number, gy: number) {
  const warp = BIOME_GEN.warp;
  const x = gx + warp.strength * noise.fractal2D(gx * warp.frequency + SALT.warpX + offset, gy * warp.frequency, { octaves: 3 });
  const y = gy + warp.strength * noise.fractal2D(gx * warp.frequency + SALT.warpY + offset, gy * warp.frequency, { octaves: 3 });
  const dx = (x - center.x) / radius.x;
  const dy = (y - center.y) / radius.y;
  const angle = Math.atan2(dy, dx);
  const edge =
    1 +
    BIOME_GEN.roughness *
      noise.fractal2D(Math.cos(angle) * BIOME_GEN.edgeFrequency + offset, Math.sin(angle) * BIOME_GEN.edgeFrequency, { octaves: 2 });
  return Math.hypot(dx, dy) / edge;
}
