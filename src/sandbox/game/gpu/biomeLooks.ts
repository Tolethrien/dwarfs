import AxiomColor from "@axiom/color";
import AxiomMath from "@axiom/math";
import { BIOME_RULES, BIOMES } from "../content/biomes";
import type World from "../world/world";
import { MAP_LOOK } from "./gameGlobals";

// two u32 per tile for the biomeLooks global, the tint then the ambient: linear r, g, b as unorm8,
// a = 255.
export function biomeLooks(world: World) {
  const tints = [0, 1, 2].map(() => new Float32Array(world.totalTiles));
  const ambients = [0, 1, 2].map(() => new Float32Array(world.totalTiles));
  for (let index = 0; index < world.totalTiles; index++) {
    const biome = world.biomeAreas[world.biomes[index]].biome;
    const data = BIOMES[biome];
    const ambient = data?.ambient ?? MAP_LOOK.ambient;
    for (let channel = 0; channel < 3; channel++) {
      const tint = data?.tint;
      tints[channel][index] = tint === undefined ? 1 : AxiomColor.srgbToLinear(tint[channel]);
      // the level dims the srgb color, so it reads as that brightness on screen
      ambients[channel][index] = AxiomColor.srgbToLinear(ambient.color[channel] * ambient.level);
    }
  }
  const tintWords = pack(world, tints);
  const ambientWords = pack(world, ambients);
  const words = new Uint32Array(world.totalTiles * 2);
  for (let index = 0; index < world.totalTiles; index++) {
    words[index * 2] = tintWords[index];
    words[index * 2 + 1] = ambientWords[index];
  }
  return words;
}

function pack(world: World, channels: Float32Array[]) {
  const width = world.mapInTiles.width;
  const height = world.mapInTiles.height;
  // two box blurs of half the transition each: together a soft bell reaching the whole
  // transition, without the hard start and end of a single box
  const radius = Math.ceil(BIOME_RULES.transition / 2);
  for (const values of channels)
    for (let pass = 0; pass < 2; pass++) {
      blur(values, width, height, radius, 1, width);
      blur(values, height, width, radius, width, 1);
    }
  const words = new Uint32Array(world.totalTiles);
  for (let index = 0; index < world.totalTiles; index++) {
    let word = 255 << 24;
    for (let channel = 0; channel < 3; channel++)
      word |= Math.round(AxiomMath.clamp(channels[channel][index], 0, 1) * 255) << (channel * 8);
    words[index] = word >>> 0;
  }
  return words;
}

function blur(values: Float32Array, length: number, count: number, radius: number, step: number, lineStep: number) {
  const line = new Float32Array(length);
  const size = radius * 2 + 1;
  for (let lineIndex = 0; lineIndex < count; lineIndex++) {
    const start = lineIndex * lineStep;
    for (let at = 0; at < length; at++) line[at] = values[start + at * step];
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset++) sum += line[AxiomMath.clamp(offset, 0, length - 1)];
    for (let at = 0; at < length; at++) {
      values[start + at * step] = sum / size;
      sum += line[Math.min(at + radius + 1, length - 1)] - line[Math.max(at - radius, 0)];
    }
  }
}
