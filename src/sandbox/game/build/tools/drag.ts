import { Draw } from "@aurora/urp/draw/draw";
import InputManager from "@engine/inputManager";
import { SORT_ORDER } from "../../content/render";
import { formatAmount, RESOURCES, type ResourceCost, type ResourcesID } from "../../content/resources";
import { checkRules, type BuildContext, type BuildRule, type BuildTool, type Placement, type Refusal } from "../build";
import { BUILD_LOOK } from "../look";

export type DragStart = { readonly from: Position2D } | { readonly refusal: string };

export interface DragLabel {
  readonly position: Position2D;
  readonly text: string;
}

export interface DragConfig<T extends Placement> {
  cost: ResourceCost;
  hint?: string;
  start?(ctx: BuildContext): DragStart;
  span(from: Position2D, ctx: BuildContext): T | undefined;
  units?(placement: T): number;
  label?(placement: T, costText: string): DragLabel;
  draw?(placement: T, valid: boolean, ctx: BuildContext): void;
  rules: readonly BuildRule<T>[];
  build(placement: T, ctx: BuildContext): void;
}

interface ActiveDrag<T extends Placement> {
  from: Position2D;
  placement: T | undefined;
  refusal: Refusal | undefined;
}

export function drag<T extends Placement>(config: DragConfig<T>): BuildTool {
  let active: ActiveDrag<T> | undefined;

  const totalCost = (placement: T): ResourceCost => {
    const count = config.units ? config.units(placement) : placement.tiles.length;
    const scaled: ResourceCost = {};
    for (const [id, amount] of Object.entries(config.cost)) {
      if (amount !== undefined) scaled[Number(id) as ResourcesID] = amount * count;
    }
    return scaled;
  };

  return {
    hint: config.hint,

    update(ctx) {
      if (!ctx.asking && !ctx.hoveredUi && InputManager.onActionPressed("place")) {
        const started = config.start ? config.start(ctx) : { from: ctx.mouseTile() };
        if ("refusal" in started) {
          ctx.pop(started.refusal);
        } else {
          active = { from: started.from, placement: undefined, refusal: undefined };
        }
      }
      if (!active) return;
      if (InputManager.onActionReleased("place")) {
        const finished = active;
        active = undefined;
        const placement = finished.placement;
        if (!placement) return;
        if (finished.refusal !== undefined) {
          ctx.pop(finished.refusal.reason);
          return;
        }
        const cost = totalCost(placement);
        if (ctx.hasMissing(cost)) return;
        ctx.store.pay(cost);
        config.build(placement, ctx);
        return;
      }
      active.placement = config.span(active.from, ctx);
      active.refusal = active.placement && checkRules(config.rules, active.placement, ctx);
    },

    render(ctx) {
      const placement = active?.placement;
      if (!active || !placement) return;
      const refusal = active.refusal;
      const cost = totalCost(placement);
      const short = refusal !== undefined || ctx.store.missing(cost).length > 0;
      if (config.draw) {
        config.draw(placement, refusal === undefined, ctx);
      } else {
        const outline = refusal !== undefined ? BUILD_LOOK.outline.refused : BUILD_LOOK.outline.free;
        if (placement.base !== undefined) ctx.drawBox(placement.base, outline, BUILD_LOOK.outline.width);
        else ctx.drawTiles(placement.tiles, outline.fill);
      }
      ctx.drawTiles(refusal?.tiles ?? []);
      if (!config.label) return;
      const textStyle = BUILD_LOOK.drag.text;
      const price = Object.entries(cost).map(([id, amount]) => {
        const resource = Number(id) as ResourcesID;
        return `${formatAmount(resource, amount ?? 0)} ${RESOURCES[resource].name}`;
      });
      const label = config.label(placement, price.join(", "));
      const tile = ctx.tile;
      Draw.text({
        position: { x: label.position.x * tile, y: (label.position.y - textStyle.gap - textStyle.size) * tile, z: SORT_ORDER.effects },
        text: label.text,
        size: textStyle.size * tile,
        color: short ? BUILD_LOOK.outline.refused.border : BUILD_LOOK.outline.free.border,
      });
    },

    cancel() {
      active = undefined;
    },
  };
}
