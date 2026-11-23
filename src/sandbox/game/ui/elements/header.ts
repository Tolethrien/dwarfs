import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, pw, px } from "@navi/units";
import { COLOR } from "@axiom/color";
import { UI_SHEET, UI_THEME } from "../../content/ui";
import { text, TextContent } from "./text";

export function header(parent: UINode, title: TextContent, paper = true, line = true) {
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
    color: paper ? UI_THEME.paper.inkRed : UI_THEME.colors.title,
    size: UI_THEME.text.header,
    font: UI_THEME.font.display,
  });
  if (line) {
    const divider = UI_SHEET.dividerRedThin;
    Navi.append(
      new UINode({
        size: { width: pw(100), height: px(paper ? 5 : UI_THEME.header.line) },
        input: "none",
        style: paper
          ? {
              backgroundColor: COLOR.WHITE,
              backgroundImage: UI_SHEET.image,
              backgroundImageCrop: divider.crop,
              backgroundImageSlice: divider.slice,
            }
          : { backgroundColor: UI_THEME.colors.accent },
      }),
      section,
    );
  }
  return section;
}
