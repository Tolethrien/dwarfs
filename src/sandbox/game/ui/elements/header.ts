import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, pw, px } from "@navi/units";
import { UI_THEME } from "../../content/ui";
import { text, TextContent } from "./text";

export function header(parent: UINode, title: TextContent) {
  const section = Navi.append(
    new UINode({
      size: { width: pw(100), height: auto() },
      style: {
        backgroundColor: UI_THEME.colors.transparent,
        layout: "stack",
        direction: "col",
        alignCross: "stretch",
        gap: UI_THEME.header.gap,
      },
    }),
    parent,
  );
  text(section, title, {
    color: UI_THEME.colors.title,
    size: UI_THEME.text.header,
  });
  Navi.append(
    new UINode({
      size: { width: pw(100), height: px(UI_THEME.header.line) },
      input: "none",
      style: { backgroundColor: UI_THEME.colors.frame },
    }),
    section,
  );
  return section;
}
