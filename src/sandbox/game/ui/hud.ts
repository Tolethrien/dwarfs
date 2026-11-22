import Navi from "@navi/navi";
import UINode from "@navi/node";
import { Tweens } from "@navi/tween";
import { auto, ph, pw, px } from "@navi/units";
import { UI_THEME } from "../content/ui";

export type HudSlot = "topLeft" | "topCenter" | "topRightBar" | "topRightUnder" | "bottomLeft" | "bottomRight";

let layer: UINode | undefined;
let topRight: UINode | undefined;
const slots = new Map<HudSlot, UINode>();

export function hudLayer() {
  if (!layer) {
    layer = Navi.append(
      new UINode({
        size: { width: pw(100), height: ph(100) },
        input: "none",
        style: { backgroundColor: UI_THEME.colors.transparent },
      }),
    );
    layer.tags.add("hud");
  }
  return layer;
}

export function showHud(shown: boolean, fadeMs?: number) {
  const root = hudLayer();
  if (!shown) {
    root.stopAllTweens();
    root.setActive(false);
    return undefined;
  }
  if (fadeMs !== undefined && !root.active) {
    root.stopAllTweens();
    root.setActive(true);
    return root.play(Tweens.fadeIn(fadeMs));
  }
  root.setActive(true);
  return undefined;
}

export function hudSlot(slot: HudSlot) {
  const existing = slots.get(slot);
  if (existing) return existing;
  if (slot === "topRightBar" || slot === "topRightUnder") {
    createTopRight();
    return slots.get(slot) as UINode;
  }
  const node = createSlot(slot);
  slots.set(slot, node);
  return node;
}

function createTopRight() {
  if (topRight) return;
  const margin = UI_THEME.spacing.screenMargin;
  topRight = Navi.append(
    new UINode({
      position: { x: px(margin), y: px(margin) },
      size: { width: auto(), height: auto() },
      input: "none",
      style: {
        anchorX: "end",
        anchorY: "start",
        backgroundColor: UI_THEME.colors.transparent,
        layout: "stack",
        direction: "col",
        alignCross: "end",
        gap: UI_THEME.spacing.gap,
      },
    }),
    hudLayer(),
  );
  topRight.tags.add("hud:topRight");
  const rowStyle = {
    backgroundColor: UI_THEME.colors.transparent,
    layout: "stack" as const,
    direction: "row" as const,
    alignCross: "center" as const,
    gap: UI_THEME.spacing.gap,
  };
  const bar = Navi.append(new UINode({ size: { width: auto(), height: auto() }, input: "none", style: rowStyle }), topRight);
  const under = Navi.append(new UINode({ size: { width: auto(), height: auto() }, input: "none", style: rowStyle }), topRight);
  bar.tags.add("hud:topRightBar");
  under.tags.add("hud:topRightUnder");
  slots.set("topRightBar", bar);
  slots.set("topRightUnder", under);
}

function createSlot(slot: Exclude<HudSlot, "topRightBar" | "topRightUnder">) {
  const margin = UI_THEME.spacing.screenMargin;
  const config = {
    topLeft: { x: margin, y: margin, anchorX: "start", anchorY: "start", direction: "col", alignCross: "start" },
    topCenter: { x: 0, y: margin, anchorX: "center", anchorY: "start", direction: "col", alignCross: "center" },
    bottomLeft: { x: margin, y: margin, anchorX: "start", anchorY: "end", direction: "row", alignCross: "end" },
    bottomRight: { x: margin, y: margin, anchorX: "end", anchorY: "end", direction: "row", alignCross: "end" },
  } as const;
  const place = config[slot];
  const node = Navi.append(
    new UINode({
      position: { x: px(place.x), y: px(place.y) },
      size: { width: auto(), height: auto() },
      input: "none",
      style: {
        anchorX: place.anchorX,
        anchorY: place.anchorY,
        backgroundColor: UI_THEME.colors.transparent,
        layout: "stack",
        direction: place.direction,
        alignCross: place.alignCross,
        gap: UI_THEME.spacing.gap,
      },
    }),
    hudLayer(),
  );
  node.tags.add(`hud:${slot}`);
  return node;
}
