import type { BuildRule } from "../build";

export function maxDepth(depth: number, reason?: string): BuildRule {
  const message = reason ?? `Stands only down to ${depth} tiles`;
  return {
    check(placement) {
      const box = placement.reserve ?? placement.base;
      if (box !== undefined) {
        if (box.y + box.h > depth) return { reason: message, tiles: [] };
        return undefined;
      }
      const deep = placement.tiles.filter((tile) => tile.y >= depth);
      if (deep.length > 0) return { reason: message, tiles: deep };
      return undefined;
    },
  };
}
