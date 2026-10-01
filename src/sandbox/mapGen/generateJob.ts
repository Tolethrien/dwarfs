import { generateMap, type MapGenConfig } from "./mapGenerator";
import World, { type WorldMeta } from "../world/world";
import type { DecoLayer } from "../content/decos";

export interface GenerateRequest {
  seed: number;
  config: MapGenConfig;
}

// the World's arrays, not the World: a class instance does not cross to another thread
export interface GenerateResult {
  meta: WorldMeta;
  solid: Uint16Array;
  discovered: Uint8Array;
  biomes: Uint8Array;
  // Maps are copied by postMessage, only the typed arrays are transferred
  decos: Record<DecoLayer, Map<number, number>>;
  ms: number;
}

// the same work in the worker and in the inline fallback
export function generateJob(request: GenerateRequest): GenerateResult {
  const started = performance.now();
  const world = generateMap(request.seed, request.config);
  return {
    meta: world.meta,
    solid: world.solid,
    discovered: world.discovered,
    biomes: world.biomes,
    decos: world.decos,
    ms: performance.now() - started,
  };
}

export function worldFromResult(result: GenerateResult) {
  return new World({
    meta: result.meta,
    solid: result.solid,
    discovered: result.discovered,
    biomes: result.biomes,
    decos: result.decos,
  });
}
