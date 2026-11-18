import Navi from "@navi/navi";
import UINode, { NodeProps } from "@navi/node";
import UIScrollBar from "@navi/elements/scrollbar";
import { px } from "@navi/units";
import InputManager from "@engine/inputManager";
import AxiomMath from "@axiom/math";
import { UI_THEME } from "../../content/ui";
import { row } from "./row";

export interface ScrollListOptions {
  width: number;
  height: number;
  offset?: number;
  autoScroll?: boolean;
}

// scrolling is pure UI, so it can run in tick (unlike button actions)
class UIScrollArea extends UINode {
  private anchor: Position2D | undefined;

  constructor(
    private readonly autoScroll: boolean,
    props: NodeProps,
  ) {
    super(props);
  }

  public tick(dt: number) {
    if (!this.autoScroll) return;
    const mouse = InputManager.getMousePos();
    if (InputManager.isMouseClicked("MIDDLE") && this.hoveredWithin)
      this.anchor = { x: mouse.x, y: mouse.y };
    if (!this.anchor) return;
    if (!InputManager.isMouseHold("MIDDLE")) {
      this.anchor = undefined;
      return;
    }
    const auto = UI_THEME.scroll.auto;
    const distance = mouse.y - this.anchor.y;
    const beyond = Math.max(0, Math.abs(distance) - auto.deadzone);
    if (beyond === 0) return;
    const step = Math.sign(distance) * beyond * auto.speed * dt;
    this.scrollOffset.y = AxiomMath.clamp(this.scrollOffset.y - step, -this.maxScroll("y"), 0);
    Navi.markLayoutDirty();
    Navi.markScrolled();
  }
}

export function scrollList(parent: UINode, options: ScrollListOptions) {
  const colors = UI_THEME.colors;
  const scroll = UI_THEME.scroll;
  const body = row(parent, { fit: true });
  const list = Navi.append(
    new UIScrollArea(options.autoScroll ?? false, {
      size: {
        width: px(options.width - scroll.width - UI_THEME.spacing.gap),
        height: px(options.height),
      },
      style: {
        backgroundColor: colors.transparent,
        layout: "stack",
        direction: "col",
        alignCross: "stretch",
        gap: UI_THEME.spacing.listGap,
        overflowY: "scroll",
      },
    }),
    body,
  );
  list.scrollOffset.y = options.offset ?? 0;
  Navi.append(
    new UIScrollBar(list, "y", {
      size: { width: px(scroll.width), height: px(options.height) },
      style: { backgroundColor: colors.scrollTrack, rounded: UI_THEME.radius.scroll },
      thumb: {
        style: {
          backgroundColor: colors.scrollThumb,
          rounded: UI_THEME.radius.scroll,
          transitionMs: UI_THEME.motion.hoverMs,
        },
        states: { hovered: { backgroundColor: colors.scrollThumbHover } },
      },
    }),
    body,
  );
  return list;
}
