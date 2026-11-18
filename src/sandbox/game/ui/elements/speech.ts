import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto } from "@navi/units";
import { UI_THEME } from "../../content/ui";
import { text } from "./text";
import { removeWorldAnchor, worldAnchor, type UIWorldAnchor } from "./world";

// lift: screen pixels from the speaker's middle up to the bubble's middle
export function speech(position: () => Position2D, line: string, lift: number) {
  const anchor = worldAnchor(position, { y: -lift });
  const bubble = Navi.append(
    new UINode({
      size: { width: auto(), height: auto() },
      style: {
        backgroundColor: UI_THEME.colors.panel,
        outline: { width: UI_THEME.outline.window, color: UI_THEME.colors.frame },
        rounded: UI_THEME.radius.window,
        padding: UI_THEME.spacing.buttonPadding,
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
