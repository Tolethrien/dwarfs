import Navi from "@navi/navi";
import UINode from "@navi/node";
import UIText from "@navi/elements/text";
import { auto, px } from "@navi/units";
import Easing from "@axiom/easing";
import { Tweens } from "@navi/tween";
import { UI_THEME } from "../../content/ui";
import { TextContent, textSource } from "./text";

export interface PopOptions {
  text: TextContent;
  color: RGBA;
  position: Position2D;
  anchorX?: "start" | "end";
  overlay?: boolean;
  textSize?: number;
  seconds?: number;
  hold?: number;
}

export class UIPop extends UIText {
  private readonly seconds: number;
  private readonly hold: number;

  constructor(options: PopOptions) {
    super(textSource(options.text), {
      position: { x: px(options.position.x), y: px(options.position.y) },
      size: { width: auto(), height: auto() },
      input: "none",
      style: {
        overlay: options.overlay ?? false,
        anchorX: options.anchorX ?? "start",
        anchorY: "start",
        textColor: options.color,
        textSize: options.textSize ?? UI_THEME.text.body,
        textOutline: {
          width: UI_THEME.bar.textOutline,
          color: UI_THEME.colors.textOutline,
        },
      },
    });
    this.seconds = options.seconds ?? UI_THEME.counter.popSeconds;
    this.hold = options.hold ?? 0;
    this.rise();
  }

  public get isShowing() {
    return this.isTweening;
  }

  public restart(color: RGBA) {
    this.style.textColor = color;
    this.rise();
  }

  // still while it's held: the UI snaps to whole pixels, a slow rise over a long time would
  // step a pixel at a time; it rises as it fades, as fast as a counter's pop
  private rise() {
    this.stopAllTweens();
    const held = this.hold * this.seconds * 1000;
    const ms = (1 - this.hold) * this.seconds * 1000;
    const up = { x: 0, y: -UI_THEME.counter.popRise };
    this.play(Tweens.after(held, Tweens.slideOut(up, ms, Easing.linear)));
    this.play(Tweens.after(held, Tweens.fadeOut(ms, Easing.linear, () => this.parent && Navi.remove(this, this.parent))));
  }
}

export function pop(parent: UINode, options: PopOptions) {
  return Navi.append(new UIPop(options), parent) as UIPop;
}

let shown: { pop: UIPop; text: string } | undefined;

export function popAt(point: Position2D, text: string, color: RGBA) {
  const scale = Navi.getScale;
  const offset = UI_THEME.counter.popTop;
  const position = { x: point.x / scale + offset, y: point.y / scale - offset };
  if (shown?.pop.isShowing && shown.text === text) {
    shown.pop.position = { x: px(position.x), y: px(position.y) };
    shown.pop.restart(color);
    Navi.markLayoutDirty();
    return shown.pop;
  }
  if (shown?.pop.parent) Navi.remove(shown.pop, shown.pop.parent);
  const message = UI_THEME.message;
  const node = pop(Navi.root, {
    text: text,
    color: color,
    position: position,
    seconds: message.seconds,
    hold: message.hold,
  });
  shown = { pop: node, text: text };
  return node;
}
