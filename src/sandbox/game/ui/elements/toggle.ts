import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, px } from "@navi/units";
import { COLOR } from "@axiom/color";
import { UI_SHEET, UI_THEME } from "../../content/ui";
import { UIButton } from "./button";
import { text, TextContent } from "./text";

export function toggle(
  parent: UINode,
  label: TextContent,
  on: boolean,
  change: (on: boolean) => void,
) {
  let isOn = on;
  const node = new UIButton(
    () => {
      isOn = !isOn;
      paint();
      change(isOn);
    },
    {
      size: { width: auto(), height: auto() },
      input: "absorb",
      style: {
        backgroundColor: UI_THEME.colors.transparent,
        padding: { top: 4, right: 6, bottom: 4, left: 2 },
        layout: "stack",
        direction: "row",
        alignCross: "center",
        gap: UI_THEME.spacing.gap,
      },
      states: {
        hovered: { backgroundColor: UI_THEME.colors.row },
      },
    },
  );
  Navi.append(node, parent);
  const size = UI_THEME.toggle.box;
  const box = Navi.append(
    new UINode({
      size: { width: px(size), height: px(size) },
      input: "none",
      style: {
        backgroundColor: COLOR.WHITE,
        backgroundImage: UI_SHEET.image,
      },
    }),
    node,
  );
  text(node, label);
  function paint() {
    box.style.backgroundImageCrop = isOn ? UI_SHEET.checkboxChecked.crop : UI_SHEET.checkboxEmpty.crop;
  }
  paint();
  return node;
}
