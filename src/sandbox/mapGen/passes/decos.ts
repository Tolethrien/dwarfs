import { DECOS, DecosID, type DecoAttached, type DecoLayer, type DecoName } from "../../content/decos";
import { packTile } from "../../world/tile";
import type GenContext from "../context";
import type { PassTools, Range } from "../context";

// chance: per tile that fits the deco, depth: 0 top of the map - 1 bottom
export type DecosConfig = Record<DecoName, { chance: number; depth: Range }>;

// where a deco may stand follows from what it is attached to, no per-kind code:
// below = air on a floor, above = air under a ceiling, self = a rock face with air over it
export function decosPass(
  ctx: GenContext,
  config: DecosConfig,
  decos: Record<DecoLayer, Map<number, number>>,
  tools: PassTools,
) {
  const kinds = (Object.keys(config) as DecoName[]).map((name) => ({
    id: DecosID[name],
    definition: DECOS[DecosID[name]],
    placement: config[name],
  }));

  for (let gy = 0; gy < ctx.height; gy++) {
    const depth = gy / ctx.height;
    for (let gx = 0; gx < ctx.width; gx++) {
      for (const kind of kinds) {
        if (depth < kind.placement.depth[0] || depth > kind.placement.depth[1]) continue;
        // one per tile over both layers, so two never overlap; both layers on a tile are for the player
        const index = ctx.index(gx, gy);
        if (decos.back.has(index) || decos.front.has(index)) continue;
        if (!fits(ctx, kind.definition.attached, gx, gy)) continue;
        if (!tools.random.bool(kind.placement.chance)) continue;
        // from the tile's hash, not the random stream: adding variants does not move the decos
        const variants = Math.max(1, kind.definition.variants.length);
        const variant = Math.min(variants - 1, Math.floor(tools.noise.white2D(gx, gy) * variants));
        decos[kind.definition.layer].set(index, packTile(kind.id, variant));
      }
    }
  }
}

function fits(ctx: GenContext, attached: DecoAttached, gx: number, gy: number) {
  if (attached === "self") return ctx.isGround(gx, gy) && ctx.isAir(gx, gy - 1);
  if (!ctx.isAir(gx, gy)) return false;
  if (attached === "below") return ctx.isGround(gx, gy + 1);
  return ctx.isGround(gx, gy - 1);
}
