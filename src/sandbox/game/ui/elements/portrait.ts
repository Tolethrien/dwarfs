import Navi from "@navi/navi";
import UINode from "@navi/node";
import { px } from "@navi/units";
import { COLOR } from "@axiom/color";
import type { SpriteLayer } from "../../components/layeredSprite";
import { RENDER_SHEET } from "../../content/render";
import { UI_THEME } from "../../content/ui";

export function portrait(parent: UINode, look: SpriteLayer[], size = UI_THEME.icon.size) {
  const node = Navi.append(
    new UINode({
      size: { width: px(size), height: px(size) },
      input: "none",
      style: { backgroundColor: UI_THEME.colors.transparent },
    }),
    parent,
  );
  for (const layer of look) {
    Navi.append(
      new UINode({
        size: { width: px(size), height: px(size) },
        input: "none",
        style: {
          backgroundColor: layer.tint ?? COLOR.WHITE,
          backgroundImage: RENDER_SHEET.dwarfs,
          backgroundImageCrop: layer.crop,
        },
      }),
      node,
    );
  }
  return node;
}
