import Navi from "@navi/navi";
import UINode from "@navi/node";
import UIText from "@navi/elements/text";
import { auto, pw, px } from "@navi/units";
import { UI_THEME } from "../../content/ui";
import { buttonProps, UIButton } from "./button";
import { text, TextContent } from "./text";

export function collapsible(
  parent: UINode,
  title: TextContent,
  open = true,
  toggled?: (open: boolean) => void,
) {
  const colors = UI_THEME.colors;
  const section = Navi.append(column(UI_THEME.header.gap), parent);
  let isOpen = open;
  const props = buttonProps({ color: colors.transparent });
  props.size = { width: pw(100), height: auto() };
  props.style = {
    ...props.style,
    alignMain: "between",
    padding: UI_THEME.collapsible.padding,
  };
  const head = new UIButton(() => {
    isOpen = !isOpen;
    body.setActive(isOpen);
    toggled?.(isOpen);
    Navi.markLayoutDirty();
  }, props);
  Navi.append(head, section);
  text(head, title, { color: colors.title, size: UI_THEME.text.header });
  Navi.append(
    new UIText(
      () => (isOpen ? UI_THEME.collapsible.open : UI_THEME.collapsible.closed),
      {
        size: { width: auto(), height: auto() },
        input: "none",
        style: { textColor: colors.muted, textSize: UI_THEME.text.header },
      },
    ),
    head,
  );
  Navi.append(
    new UINode({
      size: { width: pw(100), height: px(UI_THEME.header.line) },
      input: "none",
      style: { backgroundColor: colors.frame },
    }),
    section,
  );
  const body = Navi.append(column(UI_THEME.spacing.windowGap), section);
  body.setActive(open);
  return body;
}

function column(gap: number) {
  return new UINode({
    size: { width: pw(100), height: auto() },
    style: {
      backgroundColor: UI_THEME.colors.transparent,
      layout: "stack",
      direction: "col",
      alignCross: "stretch",
      gap: gap,
    },
  });
}
