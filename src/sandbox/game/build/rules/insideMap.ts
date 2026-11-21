import type { BuildRule } from "../build";

export function insideMap(): BuildRule {
  return {
    check(placement, ctx) {
      const world = ctx.world;
      const reserve = placement.reserve;
      if (reserve !== undefined) {
        const fits =
          reserve.x >= 0 &&
          reserve.y >= 0 &&
          reserve.x + reserve.w <= world.mapInTiles.width &&
          reserve.y + reserve.h <= world.mapInTiles.height;
        if (!fits) return { reason: "It doesn't fit in the map", tiles: [] };
        return undefined;
      }
      const outside = placement.tiles.filter((tile) => !world.inside(tile.x, tile.y));
      if (outside.length > 0) return { reason: "It doesn't fit in the map", tiles: outside };
      return undefined;
    },
  };
}
