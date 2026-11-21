import Material from "@aurora/material";
import { COLOR } from "@axiom/color";
import type { MaterialParams } from "@aurora/urp/draw/drawTypes";
import structurePlanShader from "../shaders/structurePlan.wgsl?raw";
import GameGlobals from "./gameGlobals";

// plan: a sprite (a lamp) drawn as a plan; token: a dwarf as a ball of one color; flat: a shape
// without a texture (the shaft, a building), its outline band the plan's line; must match PLAN_*
// in structurePlan.wgsl
export type PlanLook = "plan" | "token" | "flat";
const PLAN_LOOK: Record<PlanLook, number> = { plan: 0, token: 1, flat: 2 };

export default class StructurePlan {
  declare public static material: Material<"radius" | "center" | "look">;
  private static readonly params: Record<PlanLook, MaterialParams> = {
    plan: [0, 0, 0, 0],
    token: [0, 0, 0, 0],
    flat: [0, 0, 0, 0],
  };
  private static shown = false;

  public static register() {
    this.material = Material.create({
      name: "structurePlan",
      fragment: GameGlobals.shader + structurePlanShader,
      gui: false,
      params: { radius: 0, center: 0, look: PLAN_LOOK.plan },
    });
  }

  public static pack(radius: number, center: number) {
    this.shown = radius > 0;
    for (const look of Object.keys(PLAN_LOOK) as PlanLook[])
      this.params[look] = this.material.pack({ radius: radius, center: center, look: PLAN_LOOK[look] });
  }

  public static get isShown() {
    return this.shown;
  }

  // for a Draw call, nothing while the blueprint is gone; two calls, not one object: drawn every frame
  public static materialOf(look: PlanLook | undefined) {
    return this.shown && look !== undefined ? this.material : undefined;
  }

  public static paramsOf(look: PlanLook | undefined) {
    return this.shown && look !== undefined ? this.params[look] : undefined;
  }

  public static flat(line: number) {
    return {
      material: this.materialOf("flat"),
      params: this.paramsOf("flat"),
      outline: { width: line, color: COLOR.TRANSPARENT },
    };
  }
}
