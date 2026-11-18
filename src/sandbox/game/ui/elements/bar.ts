import Navi from "@navi/navi";
import UINode, { NodeProps } from "@navi/node";
import UIText from "@navi/elements/text";
import { auto, pw, px } from "@navi/units";
import AxiomMath from "@axiom/math";
import { UI_THEME } from "../../content/ui";
import { TextContent, textSource } from "./text";

export interface BarOptions {
  value: () => number;
  label?: TextContent;
  color?: RGBA;
  width?: number;
  height?: number;
}

export class UIBar extends UINode {
  private readonly fill: UINode;
  private shown = -1;

  constructor(
    private readonly value: () => number,
    props: NodeProps,
    fill: NodeProps,
  ) {
    super(props);
    this.fill = new UINode(fill);
    this.fill.parent = this;
    this.children.push(this.fill);
  }

  public contentChanged() {
    const value = AxiomMath.clamp(this.value(), 0, 1);
    if (value === this.shown) return false;
    this.shown = value;
    return true;
  }

  public layoutChildren(scale: number) {
    super.layoutChildren(scale);
    const box = this.pixelBox;
    this.fill.setBox(box.x, box.y, box.w * this.shown, box.h);
  }
}

export function bar(parent: UINode, options: BarOptions) {
  const colors = UI_THEME.colors;
  const node = new UIBar(
    options.value,
    {
      size: {
        width: options.width === undefined ? pw(100) : px(options.width),
        height: px(options.height ?? UI_THEME.bar.height),
      },
      input: "none",
      style: {
        backgroundColor: colors.barTrack,
        rounded: UI_THEME.radius.scroll,
      },
    },
    {
      input: "none",
      style: {
        backgroundColor: options.color ?? colors.barFill,
        rounded: UI_THEME.radius.scroll,
      },
    },
  );
  Navi.append(node, parent);
  if (options.label === undefined) return node;
  Navi.append(
    new UIText(textSource(options.label), {
      size: { width: auto(), height: auto() },
      input: "none",
      style: {
        anchorX: "center",
        anchorY: "center",
        textColor: colors.text,
        textSize: UI_THEME.bar.textSize,
        textOutline: {
          width: UI_THEME.bar.textOutline,
          color: colors.textOutline,
        },
      },
    }),
    node,
  );
  return node;
}
