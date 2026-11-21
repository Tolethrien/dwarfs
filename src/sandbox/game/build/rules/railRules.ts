import { BLOCKS, BlocksID } from "../../content/blocks";
import Rails from "../../systems/mine/rails";
import Stations from "../../systems/mine/stations";
import { RAILS, railEnd, railPoint, railTile, railTiles, type RailSegment } from "../../world/railShape";
import type { BuildRule, Placement } from "../build";

export interface RailPlacement extends Placement {
  readonly segment: RailSegment;
}

export function railAnchored(): BuildRule<RailPlacement> {
  return {
    check(placement, ctx) {
      const rails = ctx.scene.getSystem(Rails);
      const anchors = ctx.scene.getSystem(Stations).railAnchors;
      if (rails.arms(placement.segment.from, anchors) === 0)
        return { reason: "Start at a station's connector or a rail", tiles: [] };
      return undefined;
    },
  };
}

export function railClearance(): BuildRule<RailPlacement> {
  return {
    check(placement, ctx) {
      const rails = ctx.scene.getSystem(Rails);
      const anchors = ctx.scene.getSystem(Stations).railAnchors;
      const segment = placement.segment;
      const tiles = railTiles(segment);
      const end = railEnd(segment);

      const inTheWay: Position2D[] = [];
      const rock: Position2D[] = [];
      const addUnique = (list: Position2D[], tile: Position2D) => {
        if (!list.some((other) => other.x === tile.x && other.y === tile.y)) list.push(tile);
      };

      for (let steps = 1; steps < segment.length; steps++) {
        const point = railPoint(segment, steps);
        if (rails.arms(point, anchors) > 0) addUnique(inTheWay, railTile(point, segment.step));
      }

      const classify = (tile: Position2D, isBlocked: boolean) => {
        if (!isBlocked) return;
        if (ctx.space.tileBlocked(tile)) {
          addUnique(inTheWay, tile);
          return;
        }
        const type = ctx.world.getType(tile.x, tile.y);
        const diggable = type !== BlocksID.rail && type !== BlocksID.structure && BLOCKS[type].str !== Infinity;
        addUnique(diggable ? rock : inTheWay, tile);
      };

      // its tiles and the ones over and under them, so it doesn't touch anything with a corner; over
      // and under it the rails it joins may lie, they part from it at 45°
      tiles.forEach((tile, index) => {
        let near: Position2D | undefined;
        if (index === 0) near = segment.from;
        else if (index === tiles.length - 1) near = end;
        classify(tile, ctx.space.tileBlocked(tile) || !rails.isTileFreeForRail(tile, near));
        for (const room of [
          { x: tile.x, y: tile.y - 1 },
          { x: tile.x, y: tile.y + 1 },
        ]) {
          const blocked =
            ctx.space.tileBlocked(room) ||
            (!rails.isTileFreeForRail(room, segment.from) && !rails.isTileFreeForRail(room, end));
          classify(room, blocked);
        }
      });

      if (inTheWay.length > 0) return { reason: "Something is in the way", tiles: inTheWay };
      if (rock.length > 0) return { reason: "Dig its way out first", tiles: rock };
      return undefined;
    },
  };
}

export function railBranching(): BuildRule<RailPlacement> {
  return {
    check(placement, ctx) {
      const rails = ctx.scene.getSystem(Rails);
      const anchors = ctx.scene.getSystem(Stations).railAnchors;
      const segment = placement.segment;
      const tiles = railTiles(segment);
      const end = railEnd(segment);
      const branches: Position2D[] = [];

      for (const [point, tile] of [
        [segment.from, tiles[0]],
        [end, tiles[tiles.length - 1]],
      ] as const) {
        const arms = rails.arms(point, anchors) + 1;
        if (arms > RAILS.arms) return { reason: "A rail branches only once there", tiles: [tile] };
        if (arms < RAILS.arms) continue;
        if (rails.nearBranch(point, anchors))
          return { reason: `Branches are at least ${RAILS.spacing} tiles apart`, tiles: [tile] };
        branches.push(tile);
      }
      if (branches.length === 2 && segment.length < RAILS.spacing)
        return { reason: `Branches are at least ${RAILS.spacing} tiles apart`, tiles: branches };
      return undefined;
    },
  };
}
