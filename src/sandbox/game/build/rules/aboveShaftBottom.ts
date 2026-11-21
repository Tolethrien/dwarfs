import type { BuildRule } from "../build";

export interface AboveShaftBottomOptions {
  margin?: number;
  minRow?: number;
  reason: string;
  highlightTiles?: boolean;
}

export function aboveShaftBottom(options: AboveShaftBottomOptions): BuildRule {
  const margin = options.margin ?? 0;
  return {
    check(placement, ctx) {
      const limit = ctx.world.shaftDepth + margin;
      if (!options.highlightTiles && placement.base !== undefined) {
        const base = placement.base;
        if (options.minRow !== undefined && base.y < options.minRow) return { reason: options.reason, tiles: [] };
        if (base.y + base.h - 1 > limit) return { reason: options.reason, tiles: [] };
        return undefined;
      }
      const bad = placement.tiles.filter(
        (tile) => tile.y > limit || (options.minRow !== undefined && tile.y < options.minRow),
      );
      if (bad.length > 0) return { reason: options.reason, tiles: options.highlightTiles ? bad : [] };
      return undefined;
    },
  };
}
