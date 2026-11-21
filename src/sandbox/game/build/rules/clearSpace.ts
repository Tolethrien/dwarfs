import { BLOCKS, BlocksID } from "../../content/blocks";
import type { BuildRule, Placement } from "../build";
import { boxShape, rectShape, tilesOfShape, type BuildLayer, type SpaceShape } from "../space";

export interface ClearSpaceOptions {
  layer?: BuildLayer;
  reason?: string;
}

export function clearSpace(options?: ClearSpaceOptions): BuildRule {
  const layer = options?.layer ?? "main";
  const reason = options?.reason ?? "Something is in the way";
  return {
    check(placement, ctx) {
      const blocked: Position2D[] = [];
      const add = (tile: Position2D) => {
        if (!blocked.some((other) => other.x === tile.x && other.y === tile.y)) blocked.push(tile);
      };
      const shape = shapeOf(placement);
      if (shape !== undefined) {
        for (const tile of ctx.space.blockingTiles(shape, layer)) add(tile);
        for (const tile of tilesOfShape(shape, ctx.tile)) {
          if (ctx.world.getType(tile.x, tile.y) === BlocksID.rail) add(tile);
        }
      }
      for (const tile of placement.tiles) {
        const type = ctx.world.getType(tile.x, tile.y);
        if (type !== BlocksID.air && BLOCKS[type].str === Infinity) add(tile);
      }
      if (blocked.length > 0) return { reason: reason, tiles: blocked };
      return undefined;
    },
  };
}

function shapeOf(placement: Placement): SpaceShape | undefined {
  if (placement.spaceShape !== undefined) return placement.spaceShape;
  if (placement.reserve !== undefined) return boxShape(placement.reserve);
  if (placement.base !== undefined) return boxShape(placement.base);
  if (placement.rect !== undefined) return rectShape(placement.rect);
  return undefined;
}
