import Grid from "@axiom/grid";
import InputManager from "@engine/inputManager";
import type { ResourceCost } from "../../content/resources";
import { checkRules, type BuildContext, type BuildRule, type BuildTool, type Placement, type Refusal } from "../build";
import { BUILD_LOOK } from "../look";

export interface StampConfig<T extends Placement> {
  title: string;
  cost: ResourceCost;
  confirm?: boolean;
  rotatable?: boolean;
  hint?: string;
  locate(anchor: Position2D, rotation: number, ctx: BuildContext): T;
  rules: readonly BuildRule<T>[];
  build(placement: T, ctx: BuildContext): void;
}

export function stamp<T extends Placement>(config: StampConfig<T>): BuildTool {
  let rotation = 0;
  let rotateAnchor: Position2D | undefined;
  let placement: T | undefined;
  let refusal: Refusal | undefined;

  const updateRotation = (ctx: BuildContext) => {
    if (!config.rotatable || ctx.asking) {
      rotateAnchor = undefined;
      return;
    }
    if (InputManager.onActionPressed("rotateBuild") && !ctx.hoveredUi) {
      rotateAnchor = ctx.mouseTile();
    }
    if (rotateAnchor === undefined) return;
    if (!InputManager.onActionHold("rotateBuild")) {
      rotateAnchor = undefined;
      return;
    }
    const tile = ctx.tile;
    const mouse = ctx.mouseWorld();
    const dx = mouse.x - (rotateAnchor.x + 0.5) * tile;
    const dy = mouse.y - (rotateAnchor.y + 0.5) * tile;
    if (dx * dx + dy * dy > BUILD_LOOK.rotateDeadzoneSq) rotation = Math.atan2(dy, dx);
  };

  return {
    hint: config.hint ?? (config.rotatable ? "Hold RMB to rotate" : undefined),

    update(ctx) {
      if (ctx.asking) return;
      updateRotation(ctx);
      placement = config.locate(rotateAnchor ?? ctx.mouseTile(), rotation, ctx);
      refusal = checkRules(config.rules, placement, ctx);

      if (!InputManager.onActionPressed("place") || ctx.hoveredUi) return;
      if (!placement.rect && (!placement.base || !Grid.isTileInBox(placement.base, ctx.mouseTile()))) return;
      if (refusal !== undefined) {
        ctx.pop(refusal.reason);
        return;
      }
      if (ctx.hasMissing(config.cost)) return;
      rotateAnchor = undefined;
      const chosen = placement;
      if (config.confirm === false) {
        if (!ctx.store.pay(config.cost)) return;
        config.build(chosen, ctx);
        ctx.clearSelection();
        return;
      }
      ctx.confirmBuild(
        config.title,
        config.cost,
        () => checkRules(config.rules, chosen, ctx),
        () => config.build(chosen, ctx),
      );
    },

    render(ctx) {
      if (!placement || (ctx.hoveredUi && rotateAnchor === undefined)) return;
      const refused = refusal !== undefined;
      const outline = refused ? BUILD_LOOK.outline.refused : BUILD_LOOK.outline.free;
      if (placement.reserve !== undefined)
        ctx.drawBox(
          placement.reserve,
          refused ? BUILD_LOOK.reserve.refused : BUILD_LOOK.reserve.free,
          BUILD_LOOK.reserve.width,
        );
      if (placement.base !== undefined) ctx.drawBox(placement.base, outline, BUILD_LOOK.outline.width);
      else if (placement.rect !== undefined) ctx.drawRect(placement.rect, outline, BUILD_LOOK.outline.width);
      ctx.drawTiles(refusal?.tiles ?? []);
    },

    cancel() {
      rotateAnchor = undefined;
      placement = undefined;
      refusal = undefined;
    },
  };
}
