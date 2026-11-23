import Navi from "@navi/navi";
import UINode from "@navi/node";
import UIText from "@navi/elements/text";
import { auto, pw, px } from "@navi/units";
import { COLOR } from "@axiom/color";
import { UI_SHEET, UI_THEME } from "../../content/ui";
import { UIButton } from "./button";
import { text, TextContent } from "./text";

export type CollapsibleVariant = "section" | "footer";

export function collapsible(
  parent: UINode,
  title: TextContent,
  open = true,
  toggled?: (open: boolean) => void,
  variant: CollapsibleVariant = "section",
) {
  const section = Navi.append(column(UI_THEME.header.gap), parent);
  let isOpen = open;
  const isFooter = variant === "footer";
  const bar = isFooter ? UI_SHEET.footerBarA : UI_SHEET.hudBarMedB;
  const props = {
    size: { width: pw(100), height: px(isFooter ? 52 : 36) },
    input: "absorb" as const,
    style: {
      backgroundColor: COLOR.WHITE,
      backgroundImage: UI_SHEET.image,
      backgroundImageCrop: bar.crop,
      backgroundImageSlice: bar.slice,
      transitionMs: UI_THEME.motion.hoverMs,
      padding: isFooter
        ? { top: 16, right: 14, bottom: 6, left: 66 }
        : { top: 4, right: 12, bottom: 4, left: 12 },
      layout: "stack" as const,
      direction: "row" as const,
      alignMain: "between" as const,
      alignCross: "center" as const,
    },
    states: {
      hovered: { backgroundColor: UI_THEME.paper.hoverTint },
      pressed: { backgroundColor: UI_THEME.paper.pressTint, transitionMs: 0 },
    },
  };
  const head = new UIButton(() => {
    isOpen = !isOpen;
    body.setActive(isOpen);
    toggled?.(isOpen);
    Navi.markLayoutDirty();
  }, props);
  Navi.append(head, section);
  text(head, title, {
    color: UI_THEME.paper.inkCream,
    size: isFooter ? UI_THEME.text.header : UI_THEME.text.button,
    font: UI_THEME.font.display,
  });
  Navi.append(
    new UIText(
      () => (isOpen ? UI_THEME.collapsible.open : UI_THEME.collapsible.closed),
      {
        size: { width: auto(), height: auto() },
        input: "none",
        style: {
          textColor: UI_THEME.paper.inkCream,
          textSize: isFooter ? UI_THEME.text.header : UI_THEME.text.button,
        },
      },
    ),
    head,
  );
  const body = Navi.append(
    column(UI_THEME.spacing.windowGap, isFooter ? UI_THEME.panel.window.padding : undefined),
    section,
  );
  body.setActive(open);
  return body;
}

function column(gap: number, padding = { top: 0, right: 0, bottom: 0, left: 0 }) {
  return new UINode({
    size: { width: pw(100), height: auto() },
    style: {
      backgroundColor: UI_THEME.colors.transparent,
      padding: padding,
      layout: "stack",
      direction: "col",
      alignCross: "stretch",
      gap: gap,
    },
  });
}
