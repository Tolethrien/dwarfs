import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, pw } from "@navi/units";
import { UI_THEME } from "../../content/ui";

export function column(parent: UINode, gap = UI_THEME.spacing.windowGap) {
  return Navi.append(
    new UINode({
      size: { width: pw(100), height: auto() },
      style: {
        backgroundColor: UI_THEME.colors.transparent,
        layout: "stack",
        direction: "col",
        alignCross: "stretch",
        gap: gap,
      },
    }),
    parent,
  );
}
