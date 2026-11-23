import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, pw, px } from "@navi/units";
import { COLOR } from "@axiom/color";
import { UI_SHEET, UI_THEME } from "../../content/ui";
import { button } from "./button";
import { row } from "./row";

export interface TabItem<Id> {
  id: Id;
  title: string;
  locked?: boolean;
}

export function tabs<Id>(
  parent: UINode,
  items: TabItem<Id>[],
  selected: Id | (() => Id),
  pick: (id: Id) => void,
  paper = true,
  line = true,
) {
  if (!paper || !line) {
    const bar = row(parent, { fit: true });
    for (const item of items)
      button(bar, item.title, () => pick(item.id), {
        selected: typeof selected === "function" ? () => (selected as () => Id)() === item.id : item.id === selected,
        disabled: item.locked,
        sprite: paper ? "tab" : undefined,
      });
    return bar;
  }
  const wrap = Navi.append(
    new UINode({
      size: { width: pw(100), height: auto() },
      style: {
        backgroundColor: UI_THEME.colors.transparent,
        layout: "stack",
        direction: "col",
        alignCross: "stretch",
        gap: 0,
      },
    }),
    parent,
  );
  const bar = row(wrap, { fit: true });
  for (const item of items)
    button(bar, item.title, () => pick(item.id), {
      selected: typeof selected === "function" ? () => (selected as () => Id)() === item.id : item.id === selected,
      disabled: item.locked,
      sprite: "tab",
    });
  const divider = UI_SHEET.dividerRedThin;
  Navi.append(
    new UINode({
      size: { width: pw(100), height: px(5) },
      input: "none",
      style: {
        backgroundColor: COLOR.WHITE,
        backgroundImage: UI_SHEET.image,
        backgroundImageCrop: divider.crop,
        backgroundImageSlice: divider.slice,
      },
    }),
    wrap,
  );
  return wrap;
}
