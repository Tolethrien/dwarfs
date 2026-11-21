import type { BuildRule } from "../build";

export function discovered(): BuildRule {
  return {
    check(placement, ctx) {
      const hidden = placement.tiles.filter((tile) => !ctx.world.isTileDiscovered(tile.x, tile.y));
      if (hidden.length > 0) return { reason: "Explore this area first", tiles: hidden };
      return undefined;
    },
  };
}
