import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto } from "@navi/units";
import InputManager from "@engine/inputManager";
import { UI_THEME } from "../../content/ui";
import { TextContent, textSource } from "./text";
import { placeBeside } from "./place";
import { paragraph } from "./paragraph";
import { panelStyle } from "./panel";

const TIPS = new WeakMap<UINode, () => string>();

class UITooltip extends UINode {
  private target: UINode | undefined;
  private hoverTime = 0;
  private message = "";
  // frames placed while still hidden: the layout moves it one frame late, and its size
  // for the new message (which placeBeside reads) comes one more frame later
  private placedFrames = 0;

  constructor() {
    super({
      size: { width: auto(), height: auto() },
      input: "none",
      style: {
        ...panelStyle("small"),
        zIndex: UI_THEME.tooltip.zIndex,
      },
    });
    paragraph(this, () => this.message, {
      maxWidth: UI_THEME.tooltip.maxWidth,
    });
    // hidden until something is hovered long enough, not an empty box in the corner
    this.motion.alpha = 0;
  }

  public tick(dt: number) {
    const target = this.findTarget();
    if (target !== this.target || InputManager.isMouseHold("LEFT")) {
      this.target = target;
      this.hoverTime = 0;
      this.placedFrames = 0;
      this.motion.alpha = 0;
      return;
    }
    if (!target) return;
    this.hoverTime += dt;
    if (this.hoverTime < UI_THEME.tooltip.delaySeconds) return;
    this.message = TIPS.get(target)?.() ?? "";
    placeBeside(this, InputManager.getMousePos(), UI_THEME.tooltip.offset);
    if (this.placedFrames < 2) this.placedFrames++;
    else this.motion.alpha = 1;
  }

  private findTarget() {
    let walk = Navi.getHovered;
    while (walk && !TIPS.has(walk)) walk = walk.parent;
    return walk;
  }
}

let popup: UITooltip | undefined;

export function tooltip(node: UINode, content: TextContent) {
  if (!popup) {
    popup = new UITooltip();
    Navi.append(popup);
  }
  // the hit test skips "none", so the node has to take the hover itself
  if (node.input === "none") node.input = "normal";
  TIPS.set(node, textSource(content));
  return node;
}
