import Rails from "../../systems/mine/rails";
import type { ShaftJoint } from "../../world/railShape";
import type { BuildRule, Placement } from "../build";

export interface JointPlacement extends Placement {
  readonly joint: ShaftJoint;
}

export function jointSpacing(spacing: number): BuildRule<JointPlacement> {
  return {
    check(placement, ctx) {
      const rails = ctx.scene.getSystem(Rails);
      const row = placement.joint.tile.y;
      if (rails.joints.some((other) => Math.abs(other.tile.y - row) < spacing))
        return { reason: `Joints are at least ${spacing} rows apart`, tiles: [] };
      return undefined;
    },
  };
}
