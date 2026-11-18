import Navi from "@navi/navi";
import UINode from "@navi/node";
import { px } from "@navi/units";
import { UI_THEME } from "../../content/ui";
import { button } from "./button";
import { TextContent } from "./text";

export function toggle(
  parent: UINode,
  label: TextContent,
  on: boolean,
  change: (on: boolean) => void,
) {
  let isOn = on;
  const node = button(parent, label, () => {
    isOn = !isOn;
    paint();
    change(isOn);
  });
  const size = UI_THEME.toggle.box;
  const box = Navi.append(
    new UINode({
      size: { width: px(size), height: px(size) },
      input: "none",
      style: { rounded: UI_THEME.radius.scroll },
    }),
    node,
  );
  function paint() {
    const colors = UI_THEME.colors;
    box.style.backgroundColor = isOn ? colors.toggleOn : colors.toggleOff;
  }
  paint();
  return node;
}
