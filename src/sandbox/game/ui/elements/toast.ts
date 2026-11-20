import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, px } from "@navi/units";
import Easing from "@axiom/easing";
import { Tweens } from "@navi/tween";
import { UI_THEME } from "../../content/ui";
import { text } from "./text";
import { panelStyle } from "./panel";

export type ToastKind = "error" | "info" | "success";

// fades on raw time like every Navi tween, so toasts fade out during a pause too
class UIToast extends UINode {
  public count = 1;

  constructor(
    public readonly message: string,
    public readonly kind: ToastKind,
  ) {
    super({
      size: { width: auto(), height: auto() },
      input: "none",
      style: {
        ...panelStyle("hud", UI_THEME.toast.kinds[kind].frame),
        padding: UI_THEME.toast.padding,
      },
    });
    this.startFading();
  }

  public get isExpired() {
    return !this.isTweening;
  }

  public get label() {
    return this.count > 1 ? `${this.message} ×${this.count}` : this.message;
  }

  public repeat() {
    this.count++;
    this.startFading();
  }

  private startFading() {
    this.stopAllTweens();
    const look = UI_THEME.toast;
    const fade = Tweens.fadeOut(look.fadeSeconds * 1000, Easing.linear, () => this.parent && Navi.remove(this, this.parent));
    this.play(Tweens.after((look.seconds - look.fadeSeconds) * 1000, fade));
  }
}

let stack: UINode | undefined;

function getStack() {
  stack ??= Navi.append(
    new UINode({
      position: { x: px(0), y: px(UI_THEME.toast.top) },
      size: { width: auto(), height: auto() },
      input: "none",
      style: {
        anchorX: "center",
        backgroundColor: UI_THEME.colors.transparent,
        zIndex: UI_THEME.toast.zIndex,
        layout: "stack",
        direction: "col",
        alignCross: "center",
        gap: UI_THEME.spacing.gap,
      },
    }),
  );
  return stack;
}

export function toast(message: string, kind: ToastKind = "info") {
  const parent = getStack();
  const shown = parent.children.filter(
    (child): child is UIToast => child instanceof UIToast && !child.isExpired,
  );
  const same = shown.find(
    (child) => child.message === message && child.kind === kind,
  );
  if (same) {
    same.repeat();
    return;
  }
  if (shown.length >= UI_THEME.toast.max) Navi.remove(shown[0], parent);
  const node = new UIToast(message, kind);
  Navi.append(node, parent);
  text(node, () => node.label, {
    color: UI_THEME.toast.kinds[kind].text,
    size: UI_THEME.text.button,
  });
}
