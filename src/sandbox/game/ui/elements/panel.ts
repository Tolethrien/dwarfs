import type { Style } from "@navi/style";
import { UI_THEME } from "../../content/ui";

export type PanelLook = "window" | "hud" | "small";

// the look of every panel, spread into a node's style; the node keeps its own place and layout
export function panelStyle(look: PanelLook, frame: RGBA = UI_THEME.colors.frame): Partial<Style> {
  const theme = UI_THEME.panel;
  const size = theme[look];
  return {
    backgroundColor: UI_THEME.colors.panel,
    outline: { width: size.frame, color: frame },
    rounded: size.rounded,
    padding: size.padding,
    shadow: { color: theme.shadowColor, offset: { x: size.depth, y: size.depth } },
  };
}
