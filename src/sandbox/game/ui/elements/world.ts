import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, ph, pw } from "@navi/units";
import { Camera } from "@engine/camera/camera";
import { UI_THEME } from "../../content/ui";

export class UIWorldAnchor extends UINode {
  constructor(
    public readonly worldPosition: () => Position2D,
    public readonly offset: Position2D,
  ) {
    super({
      size: { width: auto(), height: auto() },
      style: {
        backgroundColor: UI_THEME.colors.transparent,
        layout: "stack",
        direction: "col",
        alignCross: "center",
      },
    });
  }
}

// placed in draw: the camera moves after Navi's layout, so placing in layout would lag a frame
class UIWorldLayer extends UINode {
  constructor() {
    super({
      size: { width: pw(100), height: ph(100) },
      // an info layer: nothing in it ever takes the mouse from the world
      input: "ignore",
      style: {
        backgroundColor: UI_THEME.colors.transparent,
        zIndex: UI_THEME.world.zIndex,
      },
    });
  }

  // runs before the anchors are drawn, so they read the offsets set here;
  // the layer itself has nothing to draw
  public draw() {
    const scale = Navi.getScale;
    // in screen pixels: a marker keeps its screen size at any zoom
    const margin = UI_THEME.world.cullMargin * scale;
    for (const anchor of this.children) {
      if (!(anchor instanceof UIWorldAnchor)) continue;
      const point = Camera.worldToScreen(anchor.worldPosition());
      const isOnScreen = Camera.isOnScreen(point, margin);
      // off screen it isn't measured, laid out, ticked nor drawn
      anchor.setActive(isOnScreen);
      if (!isOnScreen) continue;
      const left = point.x - anchor.pixelBox.x - anchor.pixelBox.w / 2;
      const top = point.y - anchor.pixelBox.y - anchor.pixelBox.h / 2;
      anchor.motion.offset.x = left / scale + anchor.offset.x;
      anchor.motion.offset.y = top / scale + anchor.offset.y;
    }
  }
}

let layer: UIWorldLayer | undefined;

export function worldAnchor(
  position: () => Position2D,
  offset: Partial<Position2D> = {},
) {
  if (!layer) {
    layer = new UIWorldLayer();
    Navi.append(layer);
  }
  const anchor = new UIWorldAnchor(position, {
    x: offset.x ?? 0,
    y: offset.y ?? 0,
  });
  Navi.append(anchor, layer);
  return anchor;
}

export function removeWorldAnchor(anchor: UIWorldAnchor) {
  if (anchor.parent) Navi.remove(anchor, anchor.parent);
}
