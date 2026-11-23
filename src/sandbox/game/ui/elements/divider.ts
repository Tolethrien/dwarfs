import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, px } from "@navi/units";
import { COLOR } from "@axiom/color";
import { UI_SHEET, UI_THEME } from "../../content/ui";
import { text, TextContent } from "./text";

// —— label ——
export function divider(parent: UINode, label: TextContent, paper = true) {
  const node = Navi.append(
    new UINode({
      size: { width: auto(), height: auto() },
      input: "none",
      style: {
        backgroundColor: UI_THEME.colors.transparent,
        layout: "stack",
        direction: "row",
        alignCross: "center",
        gap: UI_THEME.spacing.gap,
      },
    }),
    parent,
  );
  line(node, paper);
  text(node, label, {
    color: paper ? UI_THEME.paper.inkRed : UI_THEME.colors.muted,
    size: UI_THEME.text.body,
    font: paper ? UI_THEME.font.display : UI_THEME.font.body,
  });
  line(node, paper);
  return node;
}

function line(parent: UINode, paper: boolean) {
  const bar = UI_SHEET.dividerRedThin;
  Navi.append(
    new UINode({
      size: { width: px(UI_THEME.divider.line), height: px(paper ? 4 : UI_THEME.header.line) },
      input: "none",
      style: paper
        ? {
            backgroundColor: COLOR.WHITE,
            backgroundImage: UI_SHEET.image,
            backgroundImageCrop: bar.crop,
            backgroundImageSlice: bar.slice,
          }
        : { backgroundColor: UI_THEME.colors.frame },
    }),
    parent,
  );
}
