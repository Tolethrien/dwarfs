import type { Style } from "@navi/style";
import { COLOR } from "@axiom/color";
import { UI_SHEET, UI_THEME } from "../../content/ui";

export type PanelLook = "window" | "hud" | "small";

// the look of every panel, spread into a node's style; the node keeps its own place and layout
export function panelStyle(look: PanelLook, _frame: RGBA = UI_THEME.colors.frame): Partial<Style> {
  const sheet = UI_SHEET.paper;
  return {
    backgroundColor: COLOR.WHITE,
    backgroundImage: UI_SHEET.image,
    backgroundImageCrop: sheet.crop,
    backgroundImageSlice: sheet.slice,
    padding: UI_THEME.panel[look].padding,
  };
}
