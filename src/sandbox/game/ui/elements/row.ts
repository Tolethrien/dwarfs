import Navi from "@navi/navi";
import UINode from "@navi/node";
import type { Padding } from "@navi/style";
import { auto, pw } from "@navi/units";
import { UI_THEME } from "../../content/ui";

export interface RowOptions {
  align?: "start" | "between";
  fit?: boolean;
  gap?: number;
  background?: RGBA;
  padding?: Padding;
}

export function row(parent: UINode, options: RowOptions = {}) {
  return Navi.append(
    new UINode({
      size: { width: options.fit ? auto() : pw(100), height: auto() },
      style: {
        backgroundColor: options.background ?? UI_THEME.colors.transparent,
        rounded: UI_THEME.radius.button,
        layout: "stack",
        direction: "row",
        alignMain: options.align ?? "start",
        alignCross: "center",
        gap: options.gap ?? UI_THEME.spacing.gap,
        padding: options.padding ?? { top: 0, right: 0, bottom: 0, left: 0 },
      },
    }),
    parent,
  );
}
