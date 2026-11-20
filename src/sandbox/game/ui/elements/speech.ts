import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto } from "@navi/units";
import { UI_THEME } from "../../content/ui";
import { text } from "./text";
import { removeWorldAnchor, worldAnchor, type UIWorldAnchor } from "./world";
import { panelStyle } from "./panel";

// lift: screen pixels from the speaker's middle up to the bubble's middle
export function speech(position: () => Position2D, line: string, lift: number) {
  const anchor = worldAnchor(position, { y: -lift });
  const bubble = Navi.append(
    new UINode({
      size: { width: auto(), height: auto() },
      style: {
        ...panelStyle("hud"),
      },
    }),
    anchor,
  );
  text(bubble, line, { size: UI_THEME.text.header });
  return anchor;
}

export function removeSpeech(anchor: UIWorldAnchor) {
  removeWorldAnchor(anchor);
}
