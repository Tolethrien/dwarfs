import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, px } from "@navi/units";
import { UI_THEME } from "../../content/ui";
import { text, TextContent } from "./text";

// —— label ——
export function divider(parent: UINode, label: TextContent) {
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
  line(node);
  text(node, label, { color: UI_THEME.colors.muted, size: UI_THEME.text.body });
  line(node);
  return node;
}

function line(parent: UINode) {
  Navi.append(
    new UINode({
      size: { width: px(UI_THEME.divider.line), height: px(UI_THEME.header.line) },
      input: "none",
      style: { backgroundColor: UI_THEME.colors.frame },
    }),
    parent,
  );
}
