import AxiomMath from "@axiom/math";
import { BlocksID } from "../../content/blocks";
import type { Tile } from "../../world/tile";
import type GenContext from "../context";
import type { PassTools, Range } from "../context";

export type VeinShape = "seam" | "vein" | "cluster" | "geode";

export interface VeinConfig {
  type: Tile;
  shape: VeinShape;
  perChunk: number;
  depth: Range;
  size: Range;
  density: number;
  wallBias: number;
  district: number;
  shell?: Tile;
}

const TUNING = {
  spotAttempts: 30,
  wallReach: 3,
  // each ore reads its own area of one slow noise, so their districts do not line up
  district: { frequency: 0.012, range: 0.4, offset: 137 },
  seam: { flatness: 0.45, minHalfHeight: 1.5, tilt: 0.35, edgeNoise: 0.2 },
  vein: { turn: 0.6, thickChance: 0.35, branchChance: 0.04, branchLength: 0.35 },
  cluster: { edgeJitter: 0.7 },
  geode: { hollowChance: 0.4, hollow: 0.45 },
};

interface Deposit {
  ctx: GenContext;
  vein: VeinConfig;
  tools: PassTools;
  place: (gx: number, gy: number) => void;
}

const SHAPES: Record<VeinShape, (deposit: Deposit, spot: Position2D) => void> = {
  seam: placeSeam,
  vein: placeVein,
  cluster: placeCluster,
  geode: placeGeode,
};

export function veinsPass(
  ctx: GenContext,
  veins: readonly VeinConfig[],
  totalChunks: number,
  tools: PassTools,
) {
  for (const vein of veins) {
    const rows = {
      min: Math.floor(vein.depth[0] * ctx.height),
      max: Math.max(0, Math.floor(vein.depth[1] * ctx.height) - 1),
    };
    const count = Math.round(
      vein.perChunk * totalChunks * (vein.depth[1] - vein.depth[0]),
    );
    const deposit: Deposit = {
      ctx,
      vein,
      tools,
      place: (gx, gy) => {
        if (ctx.isGround(gx, gy) && tools.random.bool(vein.density))
          ctx.set(gx, gy, vein.type);
      },
    };

    const typeOffset = vein.type * TUNING.district.offset;
    const districtWeight = (gx: number, gy: number) => {
      const value = tools.noise.fractal2D(
        gx * TUNING.district.frequency + typeOffset,
        gy * TUNING.district.frequency,
        { octaves: 2 },
      );
      const inDistrict = AxiomMath.clamp(
        AxiomMath.inverseLerp(-TUNING.district.range, TUNING.district.range, value),
        0,
        1,
      );
      return AxiomMath.lerp(1, inDistrict, vein.district);
    };

    for (let index = 0; index < count; index++) {
      const spot = findSpot(ctx, vein, rows, districtWeight, tools);
      if (spot) SHAPES[vein.shape](deposit, spot);
    }
  }
}

// a spot outside the ore district is mostly rejected; with no cave in reach it settles for any ground,
// so veins still appear with caves turned off
function findSpot(
  ctx: GenContext,
  vein: VeinConfig,
  rows: { min: number; max: number },
  districtWeight: (gx: number, gy: number) => number,
  tools: PassTools,
): Position2D | null {
  const wantsWall = tools.random.bool(vein.wallBias);
  let fallback: Position2D | null = null;

  for (let attempt = 0; attempt < TUNING.spotAttempts; attempt++) {
    const gx = tools.random.int(0, ctx.width - 1);
    const gy = tools.random.int(rows.min, rows.max);
    if (!ctx.isGround(gx, gy)) continue;
    if (tools.random.next() > districtWeight(gx, gy)) continue;
    if (!wantsWall || ctx.nearAir(gx, gy, TUNING.wallReach)) return { x: gx, y: gy };
    fallback ??= { x: gx, y: gy };
  }
  return fallback;
}

// flat lens, thickest in the middle, slightly tilted like a coal bed
function placeSeam(deposit: Deposit, spot: Position2D) {
  const random = deposit.tools.random;
  const halfWidth = random.int(deposit.vein.size[0], deposit.vein.size[1]);
  const halfHeight = Math.max(TUNING.seam.minHalfHeight, halfWidth * TUNING.seam.flatness);
  const tilt = random.float(-TUNING.seam.tilt, TUNING.seam.tilt);
  const offset = random.float(0, 1000);

  for (let dx = -halfWidth; dx <= halfWidth; dx++) {
    const along = dx / halfWidth;
    const thickness =
      halfHeight *
      Math.sqrt(1 - along * along) *
      (1 + TUNING.seam.edgeNoise * deposit.tools.noise.perlin1D(dx * 0.3 + offset));
    const centerY = spot.y + Math.round(dx * tilt);
    const reach = Math.ceil(thickness);

    for (let dy = -reach; dy <= reach; dy++)
      if (Math.abs(dy) <= thickness) deposit.place(spot.x + dx, centerY + dy);
  }
}

function placeVein(deposit: Deposit, spot: Position2D) {
  const random = deposit.tools.random;
  const length = random.int(deposit.vein.size[0], deposit.vein.size[1]);
  walkVein(deposit, spot, random.float(0, Math.PI * 2), length, true);
}

function walkVein(
  deposit: Deposit,
  start: Position2D,
  startAngle: number,
  length: number,
  canBranch: boolean,
) {
  const random = deposit.tools.random;
  const position = { x: start.x, y: start.y };
  const offset = random.float(0, 1000);
  let angle = startAngle;

  for (let step = 0; step < length; step++) {
    angle += deposit.tools.noise.perlin1D(step * 0.15 + offset) * TUNING.vein.turn;
    position.x += Math.cos(angle);
    position.y += Math.sin(angle);
    const gx = Math.round(position.x);
    const gy = Math.round(position.y);

    deposit.place(gx, gy);
    if (random.bool(TUNING.vein.thickChance))
      deposit.place(gx + random.sign(), gy + random.int(0, 1));

    if (canBranch && random.bool(TUNING.vein.branchChance)) {
      walkVein(
        deposit,
        { x: gx, y: gy },
        angle + random.sign() * random.float(0.5, 1.2),
        Math.round(length * TUNING.vein.branchLength),
        false,
      );
    }
  }
}

function placeCluster(deposit: Deposit, spot: Position2D) {
  const random = deposit.tools.random;
  const radius = random.int(deposit.vein.size[0], deposit.vein.size[1]);
  const radiusX = Math.max(1, radius + random.int(-1, 1));
  const radiusY = Math.max(1, radius + random.int(-1, 1));

  for (let dy = -radiusY; dy <= radiusY; dy++) {
    for (let dx = -radiusX; dx <= radiusX; dx++) {
      const distance = (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);
      if (distance <= 1 + (random.next() - 0.5) * TUNING.cluster.edgeJitter)
        deposit.place(spot.x + dx, spot.y + dy);
    }
  }
}

// shell of other rock, ore inside, sometimes a hollow core
function placeGeode(deposit: Deposit, spot: Position2D) {
  const ctx = deposit.ctx;
  const random = deposit.tools.random;
  const radius = Math.max(2, random.int(deposit.vein.size[0], deposit.vein.size[1]));
  const hollow = random.bool(TUNING.geode.hollowChance);
  const reach = radius + 1;

  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const gx = spot.x + dx;
      const gy = spot.y + dy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > radius + 0.5 || !ctx.isGround(gx, gy)) continue;

      if (distance > radius - 1) {
        if (deposit.vein.shell !== undefined) ctx.set(gx, gy, deposit.vein.shell);
      } else if (hollow && distance < radius * TUNING.geode.hollow) {
        ctx.set(gx, gy, BlocksID.air);
      } else {
        deposit.place(gx, gy);
      }
    }
  }
}
