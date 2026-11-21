import { BlocksID } from "../../content/blocks";
import type { BuildRule } from "../build";

export function dugOut(reason = "Dig its room out first"): BuildRule {
  return {
    check(placement, ctx) {
      const rock = placement.tiles.filter((tile) => ctx.world.getType(tile.x, tile.y) !== BlocksID.air);
      if (rock.length > 0) return { reason: reason, tiles: rock };
      return undefined;
    },
  };
}
