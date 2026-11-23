import Navi from "@navi/navi";
import UINode, { NodeProps } from "@navi/node";
import UIText from "@navi/elements/text";
import { auto, pw, px } from "@navi/units";
import AxiomMath from "@axiom/math";
import { COLOR } from "@axiom/color";
import { UI_SHEET, UI_THEME } from "../../content/ui";
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
    const inset = 2 * scale;
    const innerW = Math.max(0, box.w - inset * 2);
    const innerH = Math.max(0, box.h - inset * 2);
    this.fill.setBox(box.x + inset, box.y + inset, innerW * this.shown, innerH);
  }
}

export function bar(parent: UINode, options: BarOptions) {
  const colors = UI_THEME.colors;
  const track = UI_SHEET.barTrack;
  const fillSheet = UI_SHEET.barBrass;
  const node = new UIBar(
    options.value,
    {
      size: {
        width: options.width === undefined ? pw(100) : px(options.width),
        height: px(options.height ?? UI_THEME.bar.height),
      },
      input: "none",
      style: {
        backgroundColor: COLOR.WHITE,
        backgroundImage: UI_SHEET.image,
        backgroundImageCrop: track.crop,
        backgroundImageSlice: track.slice,
      },
    },
    {
      input: "none",
      style: options.color
        ? {
            backgroundColor: options.color,
            rounded: UI_THEME.radius.scroll,
          }
        : {
            backgroundColor: COLOR.WHITE,
            backgroundImage: UI_SHEET.image,
            backgroundImageCrop: fillSheet.crop,
            backgroundImageSlice: fillSheet.slice,
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
        textColor: UI_THEME.paper.inkCream,
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
