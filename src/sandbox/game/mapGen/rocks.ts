import AxiomMath from "@axiom/math";
import type Noise from "@axiom/noise";
import { BlocksID } from "../content/blocks";

// blob: a lump, stretched along a direction that slowly turns over the map; seam: flat horizontal
// beds; folds: beds bent and crumpled; veins: thin branching lines, only inside regions of the rock
type PatchShape = "blob" | "seam" | "folds" | "veins";

interface RockPatch {
  block: BlocksID;
  depth: { from: number; to: number };
  coverage: number;
  frequency: number;
  shape: PatchShape;
  stretch: number;
}

// depths in tiles from the map's top. A layer starts at from; around that line both layers mix in
// patches, over blend.above tiles above it and blend.below under it. Patches: masses of other rock
// inside the stone, coverage is roughly the share of stone they take within their depths (for veins
// the share of their regions); stretch: how many times longer than tall the noise is drawn
export const ROCKS = {
  layers: [
    { block: BlocksID.dirt, from: 0, blend: { above: 0, below: 0 } },
    { block: BlocksID.sandstone, from: 25, blend: { above: 15, below: 70 } },
    { block: BlocksID.stone, from: 160, blend: { above: 40, below: 50 } },
  ],
  boundary: { warp: 12, frequency: 0.02 },
  mix: { frequency: 0.1 },
  patches: [
    { block: BlocksID.granite, depth: { from: 200, to: 1400 }, coverage: 0.2, frequency: 0.03, shape: "blob", stretch: 2 },
    { block: BlocksID.slate, depth: { from: 300, to: 800 }, coverage: 0.15, frequency: 0.03, shape: "seam", stretch: 6 },
    { block: BlocksID.gneiss, depth: { from: 700, to: 1400 }, coverage: 0.18, frequency: 0.025, shape: "folds", stretch: 3 },
    { block: BlocksID.marble, depth: { from: 400, to: 1400 }, coverage: 0.3, frequency: 0.04, shape: "veins", stretch: 1 },
  ] as RockPatch[],
  patchFade: 40,
  shapes: {
    blob: { turnFrequency: 0.004 },
    folds: { warp: 2 },
    veins: { width: 0.07, regionFrequency: 0.012 },
  },
};

// the noise's coordinate offsets per use, so the layers' mixes and the patches don't repeat each other
const SALT = { boundary: 100, mix: 200, patches: 300, turn: 50, region: 80 };

export function rockAt(noise: Noise, gx: number, gy: number) {
  const shifted = gy + ROCKS.boundary.warp * noise.fractal2D(gx * ROCKS.boundary.frequency, gy * ROCKS.boundary.frequency + SALT.boundary, { octaves: 3 });
  let block = ROCKS.layers[0].block;
  for (let index = 1; index < ROCKS.layers.length; index++) {
    const layer = ROCKS.layers[index];
    const mix = noise01(noise, gx * ROCKS.mix.frequency + SALT.mix * index, gy * ROCKS.mix.frequency);
    if (mix < layerShare(shifted, layer)) block = layer.block;
  }
  if (block !== BlocksID.stone) return block;
  for (let index = 0; index < ROCKS.patches.length; index++) {
    const patch = ROCKS.patches[index];
    const coverage = patch.coverage * depthFade(gy, patch.depth);
    if (coverage <= 0) continue;
    if (isPatch(noise, patch, gx, gy, SALT.patches * (index + 1), coverage)) return patch.block;
  }
  return block;
}

function isPatch(noise: Noise, patch: RockPatch, gx: number, gy: number, salt: number, coverage: number) {
  const shapes = ROCKS.shapes;
  const x = gx * patch.frequency;
  const y = gy * patch.frequency;
  if (patch.shape === "blob") {
    const turn = Math.PI * noise01(noise, gx * shapes.blob.turnFrequency + salt + SALT.turn, gy * shapes.blob.turnFrequency);
    const along = (x * Math.cos(turn) + y * Math.sin(turn)) / patch.stretch;
    const across = y * Math.cos(turn) - x * Math.sin(turn);
    return noise01(noise, along + salt, across) > 1 - coverage;
  }
  if (patch.shape === "seam") return noise01(noise, x / patch.stretch + salt, y) > 1 - coverage;
  if (patch.shape === "folds") {
    const value = noise.warp2D(x / patch.stretch + salt, y, shapes.folds.warp, { octaves: 2 });
    return AxiomMath.inverseLerp(-0.5, 0.5, value) > 1 - coverage;
  }
  const region = noise01(noise, gx * shapes.veins.regionFrequency + salt + SALT.region, gy * shapes.veins.regionFrequency);
  if (region <= 1 - coverage) return false;
  return noise.fractal2D(x / patch.stretch + salt, y, { mode: "ridged", octaves: 3 }) > 1 - shapes.veins.width;
}

// how much of the tile's depth belongs to the layer: 0 above its blend, 0.5 on its line, 1 under it
function layerShare(depth: number, layer: (typeof ROCKS.layers)[number]) {
  if (depth < layer.from) {
    if (layer.blend.above === 0) return 0;
    return 0.5 * AxiomMath.clamp(AxiomMath.inverseLerp(layer.from - layer.blend.above, layer.from, depth), 0, 1);
  }
  if (layer.blend.below === 0) return 1;
  return 0.5 + 0.5 * AxiomMath.clamp(AxiomMath.inverseLerp(layer.from, layer.from + layer.blend.below, depth), 0, 1);
}

function depthFade(gy: number, depth: { from: number; to: number }) {
  if (gy < depth.from || gy > depth.to) return 0;
  return Math.min(1, (gy - depth.from) / ROCKS.patchFade, (depth.to - gy) / ROCKS.patchFade);
}

// fbm rarely leaves -0.5..0.5, so stretching that range spreads the values evenly over 0..1
function noise01(noise: Noise, x: number, y: number) {
  return AxiomMath.clamp(AxiomMath.inverseLerp(-0.5, 0.5, noise.fractal2D(x, y, { octaves: 2 })), 0, 1);
}
