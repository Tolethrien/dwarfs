import Navi from "@navi/navi";
import UINode from "@navi/node";
import UIText from "@navi/elements/text";
import { auto, px } from "@navi/units";
import { UI_THEME } from "../../content/ui";
import type { DrawShadow } from "@aurora/urp/draw/drawTypes";

export type TextContent = string | (() => string);
export interface TextLook {
  color?: RGBA;
  size?: number;
  width?: number;
  font?: string;
  shadow?: DrawShadow;
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
        textFont: look.font ?? UI_THEME.font.body,
        textShadow: look.shadow,
      },
    }),
    parent,
  );
}
