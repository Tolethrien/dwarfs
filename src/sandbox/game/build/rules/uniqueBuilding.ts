import type { BuildingsID } from "../../content/structures";
import { CAMP_BUILDINGS } from "../../sceneData";
import type { BuildRule } from "../build";

export function uniqueBuilding(id: BuildingsID): BuildRule {
  return {
    check(_placement, ctx) {
      if (ctx.scene.sharedData.require(CAMP_BUILDINGS).placeOf(id) !== undefined)
        return { reason: "It's built already", tiles: [] };
      return undefined;
    },
  };
}
