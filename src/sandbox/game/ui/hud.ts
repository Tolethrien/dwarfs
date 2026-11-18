import Navi from "@navi/navi";
import UINode from "@navi/node";
import { ph, pw } from "@navi/units";
import { UI_THEME } from "../content/ui";

// the game's always-on panels (resources, clock, buffs) hang in one layer, so they hide together
let layer: UINode | undefined;

export function hudLayer() {
  if (!layer)
    layer = Navi.append(
      new UINode({
        size: { width: pw(100), height: ph(100) },
        input: "none",
        style: { backgroundColor: UI_THEME.colors.transparent },
      }),
    );
  return layer;
}

export function showHud(shown: boolean) {
  hudLayer().setActive(shown);
}
