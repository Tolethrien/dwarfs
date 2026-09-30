import { BlocksID } from "../../managers/entitiesObject";
import type GenContext from "../context";
import type { PassTools, Range } from "../context";
import type { CraterArea } from "./crater";

export interface ChestsConfig {
  spacing: number;
  searchRadius: number;
  fallbackChance: number;
  nearStart: Range;
}

const TUNING = {
  nearStart: { from: 2, to: 10, attempts: 40, searchRadius: 3 },
  nook: { reach: 2, weight: 4 },
};

export function chestsPass(
  ctx: GenContext,
  config: ChestsConfig,
  crater: CraterArea | null,
  tools: PassTools,
) {
  const points = tools.noise.poissonDisk(
    { min: { x: 0, y: 0 }, max: { x: ctx.width, y: ctx.height } },
    config.spacing,
  );

  for (const point of points) {
    const gx = Math.floor(point.x);
    const gy = Math.floor(point.y);
    if (!ctx.playable(gx, gy)) continue;

    const spot = findWallSpot(ctx, gx, gy, config.searchRadius);
    if (spot) ctx.set(spot.x, spot.y, BlocksID.hiddenChest);
    else if (ctx.isGround(gx, gy) && tools.random.bool(config.fallbackChance))
      ctx.set(gx, gy, BlocksID.hiddenChest);
  }

  if (!crater) return;
  const count = tools.random.int(config.nearStart[0], config.nearStart[1]);
  for (let chest = 0; chest < count; chest++) {
    for (let attempt = 0; attempt < TUNING.nearStart.attempts; attempt++) {
      const angle = tools.random.float(0, Math.PI * 2);
      const distance = tools.random.float(
        crater.radius + TUNING.nearStart.from,
        crater.radius + TUNING.nearStart.to,
      );
      const gx = Math.round(crater.center.x + Math.cos(angle) * distance);
      const gy = Math.round(crater.center.y + Math.sin(angle) * distance);
      if (!ctx.isGround(gx, gy)) continue;

      const spot = findWallSpot(ctx, gx, gy, TUNING.nearStart.searchRadius) ?? {
        x: gx,
        y: gy,
      };
      ctx.set(spot.x, spot.y, BlocksID.hiddenChest);
      break;
    }
  }
}

// rock touching air with as little air around as possible: the end of a passage or a nook beats an open wall
function findWallSpot(
  ctx: GenContext,
  gx: number,
  gy: number,
  radius: number,
): Position2D | null {
  let best: Position2D | null = null;
  let bestScore = Infinity;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = gx + dx;
      const y = gy + dy;
      if (!ctx.isGround(x, y) || !ctx.touchesAir(x, y)) continue;

      const score = dx * dx + dy * dy + airAround(ctx, x, y) * TUNING.nook.weight;
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}

function airAround(ctx: GenContext, gx: number, gy: number) {
  let air = 0;
  for (let dy = -TUNING.nook.reach; dy <= TUNING.nook.reach; dy++)
    for (let dx = -TUNING.nook.reach; dx <= TUNING.nook.reach; dx++)
      if (ctx.isAir(gx + dx, gy + dy)) air++;
  return air;
}
