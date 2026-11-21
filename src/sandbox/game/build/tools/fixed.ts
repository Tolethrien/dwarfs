import Grid from "@axiom/grid";
import InputManager from "@engine/inputManager";
import type { ResourceCost } from "../../content/resources";
import { checkRules, type BuildContext, type BuildRule, type BuildTool, type Placement } from "../build";
import { BUILD_LOOK } from "../look";

export interface FixedConfig<T extends Placement> {
  title: string;
  cost: ResourceCost;
  hint?: string;
  locate(ctx: BuildContext): T;
  pickRules?: readonly BuildRule<T>[];
  rules?: readonly BuildRule<T>[];
  build(placement: T, ctx: BuildContext): void;
}

export function fixed<T extends Placement>(config: FixedConfig<T>): BuildTool {
  let placement: T | undefined;

  return {
    hint: config.hint,

    onPick(ctx) {
      const candidate = config.locate(ctx);
      if (config.pickRules !== undefined) {
        const refusal = checkRules(config.pickRules, candidate, ctx);
        if (refusal !== undefined) {
          ctx.pop(refusal.reason);
          placement = undefined;
          return false;
        }
      }
      placement = candidate;
      if (placement.base !== undefined) ctx.focus(placement.base);
      return true;
    },

    update(ctx) {
      if (ctx.asking || !placement || !InputManager.onActionPressed("place") || ctx.hoveredUi) return;
      if (placement.base !== undefined && !Grid.isTileInBox(placement.base, ctx.mouseTile())) return;
      if (config.rules !== undefined) {
        const refusal = checkRules(config.rules, placement, ctx);
        if (refusal !== undefined) {
          ctx.pop(refusal.reason);
          return;
        }
      }
      if (ctx.hasMissing(config.cost)) return;
      const chosen = placement;
      ctx.confirmBuild(
        config.title,
        config.cost,
        () => (config.rules ? checkRules(config.rules, chosen, ctx) : undefined),
        () => config.build(chosen, ctx),
      );
    },

    render(ctx) {
      if (placement?.base !== undefined) ctx.drawBox(placement.base, BUILD_LOOK.outline.free, BUILD_LOOK.outline.width);
    },

    cancel() {
      placement = undefined;
    },
  };
}
