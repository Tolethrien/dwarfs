import AxiomMath from "@axiom/math";
import Noise from "@axiom/noise";
import type { Tile } from "../../world/tile";
import type GenContext from "../context";
import type { PassTools } from "../context";

export interface RockLayer {
  until: number;
  rocks: readonly Tile[];
}

export interface RockConfig {
  layers: readonly RockLayer[];
  boundary: { warp: number; frequency: number };
  patches: { frequency: number };
}

const TUNING = {
  // fbm rarely leaves this range, so the variants spread evenly instead of piling in the middle
  patchRange: 0.5,
  step: { boundary: 4, patches: 2 },
};

export function layerAt(layers: readonly RockLayer[], depth: number) {
  for (let index = 0; index < layers.length; index++)
    if (depth < layers[index].until) return index;
  return layers.length - 1;
}

export function rockPass(ctx: GenContext, config: RockConfig, tools: PassTools) {
  const size = { width: ctx.width, height: ctx.height };
  const shifts = Noise.sampleGrid(size, TUNING.step.boundary, (gx, gy) =>
    tools.noise.fractal2D(
      gx * config.boundary.frequency,
      gy * config.boundary.frequency,
      { octaves: 3 },
    ),
  );
  const patches = Noise.sampleGrid(size, TUNING.step.patches, (gx, gy) =>
    tools.noise.fractal2D(
      gx * config.patches.frequency + 300,
      gy * config.patches.frequency,
      { octaves: 2 },
    ),
  );

  for (let gy = 0; gy < ctx.height; gy++) {
    for (let gx = 0; gx < ctx.width; gx++) {
      const index = ctx.index(gx, gy);
      if (ctx.mask[index] !== 1) continue;

      const shift = config.boundary.warp * shifts[index];
      const layer = config.layers[layerAt(config.layers, (gy + shift) / ctx.height)];
      const variant = Math.floor(
        AxiomMath.clamp(
          AxiomMath.inverseLerp(-TUNING.patchRange, TUNING.patchRange, patches[index]),
          0,
          0.9999,
        ) * layer.rocks.length,
      );
      ctx.solid[index] = layer.rocks[variant];
    }
  }
}
