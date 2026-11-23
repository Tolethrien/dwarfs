import Navi from "@navi/navi";
import UINode, { NodeProps } from "@navi/node";
import { px } from "@navi/units";
import { COLOR } from "@axiom/color";
import { UI_SHEET, UI_THEME } from "../../content/ui";
import { badge } from "./badge";
import { buttonProps, fillButton, UIButton } from "./button";
import { MenuItem } from "./contextMenu";
import { TextContent } from "./text";
import { tooltip } from "./tooltip";

export interface SlotOptions {
  icon?: Crop;
  label?: TextContent;
  count?: () => number;
  // read every frame: picking a slot must not rebuild it, or the double click is lost
  selected?: () => boolean;
  empty?: boolean;
  locked?: boolean;
  click?: () => void;
  // a double click runs click first, then this (the first click is a click on its own)
  doubleClick?: () => void;
  menu?: () => MenuItem[];
  tooltip?: TextContent;
  tag?: string;
}

export class UISlot extends UIButton {
  private frame: UINode | undefined;
  private isSelected = false;

  constructor(
    public readonly options: SlotOptions,
    props: NodeProps,
  ) {
    super(options.click ?? (() => {}), props);
  }

  public setFrame(frame: UINode) {
    this.frame = frame;
    frame.motion.alpha = 0;
  }

  public contentChanged() {
    const selected = this.options.selected?.() ?? false;
    if (selected === this.isSelected || !this.frame) return false;
    this.isSelected = selected;
    this.frame.motion.alpha = selected ? 1 : 0;
    return false;
  }
}

export function slot(parent: UINode, options: SlotOptions) {
  const look = {
    icon: options.icon,
    iconSize: UI_THEME.slot.iconSize,
    disabled: options.empty || options.locked,
    sprite: "dark" as const,
  };
  const sheet = UI_SHEET.slot;
  const props = buttonProps(look);
  const size = px(UI_THEME.slot.size);
  props.minSize = { width: size, height: size };
  props.style = {
    ...props.style,
    backgroundColor: options.empty ? UI_THEME.paper.pressTint : COLOR.WHITE,
    backgroundImage: UI_SHEET.image,
    backgroundImageCrop: sheet.crop,
    backgroundImageSlice: sheet.slice,
    alignMain: "center",
  };
  const node = new UISlot(options, props);
  if (options.tag) node.tags.add(options.tag);
  Navi.append(node, parent);
  fillButton(node, options.label ?? "", look);
  if (options.selected) node.setFrame(selectionFrame(node));
  if (options.count) badge(node, options.count);
  if (options.tooltip !== undefined) tooltip(node, options.tooltip);
  return node;
}

function selectionFrame(node: UISlot) {
  return Navi.append(
    new UINode({
      input: "none",
      style: {
        overlay: true,
        anchorX: "stretch",
        anchorY: "stretch",
        backgroundColor: UI_THEME.colors.transparent,
        outline: {
          width: UI_THEME.slot.frame,
          color: UI_THEME.colors.slotFrame,
        },
        rounded: UI_THEME.radius.button,
      },
    }),
    node,
  );
}
