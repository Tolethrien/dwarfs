import Navi from "@navi/navi";
import UINode from "@navi/node";
import UIText from "@navi/elements/text";
import { auto, px } from "@navi/units";
import { UI_THEME } from "../../content/ui";

export type TextContent = string | (() => string);
export interface TextLook {
  color?: RGBA;
  size?: number;
  width?: number;
}

export function textSource(content: TextContent) {
  if (typeof content === "string") return () => content;
  return content;
}

export function text(parent: UINode, content: TextContent, look: TextLook = {}) {
  return Navi.append(
    new UIText(textSource(content), {
      size: { width: look.width === undefined ? auto() : px(look.width), height: auto() },
      input: "none",
      style: {
        textColor: look.color ?? UI_THEME.colors.text,
        textSize: look.size ?? UI_THEME.text.body,
      },
    }),
    parent,
  );
}
