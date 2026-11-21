import { assert } from "@axiom/utils";
import ShaftDigging from "../../components/mine/shaftDigging";
import { CAMP_BUILDINGS, MINE_SHAFT } from "../../sceneData";
import type { BuildRule } from "../build";

export function shaftLimit(segment: number): BuildRule {
  return {
    check(_placement, ctx) {
      const buildings = ctx.scene.sharedData.require(CAMP_BUILDINGS);
      const limit = buildings.shaftLimit;
      if (ctx.world.shaftDepth + segment > limit)
        return {
          reason: `Headquarters level ${buildings.mineLevel} lets the shaft reach ${limit} tiles`,
          tiles: [],
        };
      return undefined;
    },
  };
}

export function shaftFitsMap(segment: number): BuildRule {
  return {
    check(_placement, ctx) {
      const digging = ctx.scene.sharedData.require(MINE_SHAFT).getComponent(ShaftDigging);
      assert(digging !== undefined, "The shaft has no ShaftDigging");
      if (!digging.fits(segment)) return { reason: "The shaft can't go that deep", tiles: [] };
      return undefined;
    },
  };
}
