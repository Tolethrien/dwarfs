import InputManager from "@engine/inputManager";
import type { BuildContext, BuildTool } from "../build";
import { BUILD_LOOK } from "../look";

export type PaintRemover = (tiles: Position2D[], ctx: BuildContext) => void;

export interface RemoveConfig {
  paintRemovers: readonly PaintRemover[];
}

export function removeTool(config: RemoveConfig): BuildTool {
  let painted: Position2D[] | undefined;

  return {
    update(ctx) {
      if (!ctx.asking && !ctx.hoveredUi && InputManager.onActionPressed("place")) {
        const entry = ctx.space.removableAt(ctx.mouseWorld(), ctx.layer);
        if (entry?.removable !== undefined) {
          const removable = entry.removable;
          const problem = removable.canRemove?.();
          if (problem !== undefined) {
            ctx.pop(problem);
            return;
          }
          if (removable.confirm === false) {
            removable.remove();
            return;
          }
          ctx.confirmRemove(
            removable.label(),
            removable.warning?.(),
            () => removable.canRemove?.(),
            () => removable.remove(),
          );
          return;
        }
        painted = [];
      }
      if (!painted) return;
      if (InputManager.onActionReleased("place")) {
        const tiles = painted;
        painted = undefined;
        for (const remover of config.paintRemovers) remover(tiles, ctx);
        return;
      }
      const tile = ctx.mouseTile();
      if (!painted.some((other) => other.x === tile.x && other.y === tile.y)) painted.push(tile);
    },

    render(ctx) {
      if (painted !== undefined) {
        ctx.drawTiles(painted);
        return;
      }
      if (ctx.hoveredUi) return;
      const entry = ctx.space.removableAt(ctx.mouseWorld(), ctx.layer);
      if (!entry) return;
      if (entry.shape.kind === "box")
        ctx.drawBox(entry.shape.box, BUILD_LOOK.outline.refused, BUILD_LOOK.outline.width);
      else ctx.drawRect(entry.shape.rect, BUILD_LOOK.outline.refused, BUILD_LOOK.outline.width);
    },

    cancel() {
      painted = undefined;
    },
  };
}
