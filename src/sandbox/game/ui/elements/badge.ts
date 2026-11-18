import Navi from "@navi/navi";
import UINode from "@navi/node";
import UIText from "@navi/elements/text";
import { auto, px } from "@navi/units";
import { UI_THEME } from "../../content/ui";

class UIBadge extends UINode {
  private shown = -1;

  constructor(private readonly count: () => number) {
    super({
      position: {
        x: px(-UI_THEME.badge.offset),
        y: px(-UI_THEME.badge.offset),
      },
      size: { width: auto(), height: auto() },
      minSize: {
        width: px(UI_THEME.badge.size),
        height: px(UI_THEME.badge.size),
      },
      input: "none",
      style: {
        overlay: true,
        anchorX: "end",
        anchorY: "start",
        backgroundColor: UI_THEME.colors.badge,
        rounded: UI_THEME.radius.button,
        padding: UI_THEME.badge.padding,
        layout: "stack",
        alignMain: "center",
        alignCross: "center",
      },
    });
  }

  public get label() {
    const count = this.shown;
    return count > UI_THEME.badge.max ? `${UI_THEME.badge.max}+` : `${count}`;
  }

  public contentChanged() {
    const count = this.count();
    if (count === this.shown) return false;
    this.shown = count;
    this.motion.alpha = count > 0 ? 1 : 0;
    return true;
  }
}

export function badge(node: UINode, count: () => number) {
  const dot = new UIBadge(count);
  Navi.append(dot, node);
  Navi.append(
    new UIText(() => dot.label, {
      size: { width: auto(), height: auto() },
      input: "none",
      style: {
        textColor: UI_THEME.colors.text,
        textSize: UI_THEME.badge.textSize,
      },
    }),
    dot,
  );
  return dot;
}
