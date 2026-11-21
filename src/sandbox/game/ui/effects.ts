import Navi from "@navi/navi";
import UINode from "@navi/node";
import { Tweens, type Tween } from "@navi/tween";
import { auto, ph, pw, px } from "@navi/units";
import type { CoroutineWait } from "@engine/coroutines/coroutine";
import AxiomMath from "@axiom/math";
import Easing, { type EasingName } from "@axiom/easing";
import { UI_THEME } from "../content/ui";
import { panelStyle } from "./elements/panel";
import { paragraph } from "./elements/paragraph";
import { textSource, type TextContent } from "./elements/text";

const UI_EFFECTS = {
  slideFallback: 240,
  moveMs: 260,
  highlightWidth: 3,
  highlightZIndex: 10,
  spotlightZIndex: 90,
  spotlightPad: 6,
  calloutZIndex: 108,
  calloutGap: 10,
};

export type UITransition = "fade" | "pop" | "slideLeft" | "slideRight" | "slideTop" | "slideBottom";

export interface MoveOptions {
  ms?: number;
  ease?: EasingName;
}

export interface UIHandle {
  release(): void;
}

export function isVisibleInTree(node: UINode) {
  let walk: UINode | undefined = node;
  while (walk !== undefined) {
    if (!walk.active) return false;
    walk = walk.parent;
  }
  return true;
}

export function waitTweens(tweens: Tween[], label: string): CoroutineWait {
  if (tweens.length === 0) return { tick: () => true, describe: () => label };
  return {
    tick: () => tweens.every((tween) => tween.finished),
    skip: () => {
      for (const tween of tweens) tween.skip();
    },
    describe: () => label,
  };
}

export function showNode(node: UINode, transition?: UITransition): Tween | undefined {
  node.stopAllTweens();
  node.setActive(true);
  Navi.markLayoutDirty();
  if (!transition) return undefined;
  const tween = enterTween(node, transition);
  return node.play(tween);
}

export function hideNode(node: UINode, transition?: UITransition): Tween | undefined {
  node.stopAllTweens();
  if (!transition) {
    node.setActive(false);
    Navi.markLayoutDirty();
    return undefined;
  }
  const done = () => {
    node.setActive(false);
    node.stopAllTweens();
    Navi.markLayoutDirty();
  };
  return node.play(exitTween(node, transition, done));
}

export function moveNode(node: UINode, to: Position2D, options: MoveOptions = {}): Tween {
  const fromX = node.motion.offset.x;
  const fromY = node.motion.offset.y;
  const ms = options.ms ?? UI_EFFECTS.moveMs;
  const ease = Easing[options.ease ?? "easeOutCubic"];
  const tween: Tween = {
    ms: ms,
    loop: false,
    delay: 0,
    elapsed: 0,
    finished: false,
    onDone: undefined,
    sample: (progress) => {
      const eased = ease(progress);
      return { x: AxiomMath.lerp(fromX, to.x, eased), y: AxiomMath.lerp(fromY, to.y, eased) };
    },
    tick: () => tween.finished,
    skip: () => {
      tween.elapsed = Math.max(tween.elapsed, tween.delay + tween.ms);
    },
    describe: () => `move ${Math.round(tween.elapsed)} / ${tween.ms} ms`,
  };
  return node.play(tween);
}

export function createHighlight(node: UINode, color: RGBA = UI_THEME.colors.gain) {
  return Navi.append(
    new UINode({
      size: { width: pw(100), height: ph(100) },
      input: "none",
      style: {
        overlay: true,
        zIndex: UI_EFFECTS.highlightZIndex,
        backgroundColor: UI_THEME.colors.transparent,
        outline: { width: UI_EFFECTS.highlightWidth, color: color },
      },
    }),
    node,
  );
}

export class UISpotlight {
  private readonly strips: UINode[];
  private lastHole = "";

  constructor(
    public readonly tag: string,
    blockRest: boolean,
  ) {
    const input = blockRest ? "absorb" : "none";
    this.strips = Array.from({ length: 4 }, () =>
      Navi.append(
        new UINode({
          size: { width: px(0), height: px(0) },
          input: input,
          style: {
            backgroundColor: UI_THEME.colors.dim,
            zIndex: UI_EFFECTS.spotlightZIndex,
          },
        }),
      ),
    );
    this.setVisible(false);
  }

  public sync() {
    const target = findVisible(this.tag);
    if (!target || target.pixelBox.w <= 0 || target.pixelBox.h <= 0) {
      this.setVisible(false);
      return;
    }
    const scale = Navi.getScale;
    const screen = Navi.root.pixelBox;
    const box = target.pixelBox;
    const pad = UI_EFFECTS.spotlightPad * scale;
    const x0 = AxiomMath.clamp(box.x - pad, 0, screen.w);
    const y0 = AxiomMath.clamp(box.y - pad, 0, screen.h);
    const x1 = AxiomMath.clamp(box.x + box.w + pad, 0, screen.w);
    const y1 = AxiomMath.clamp(box.y + box.h + pad, 0, screen.h);
    const hole = `${Math.round(x0)},${Math.round(y0)},${Math.round(x1)},${Math.round(y1)},${screen.w},${screen.h}`;
    this.setVisible(true);
    if (hole === this.lastHole) return;
    this.lastHole = hole;

    const screenW = screen.w / scale;
    const screenH = screen.h / scale;
    const left = x0 / scale;
    const top = y0 / scale;
    const right = x1 / scale;
    const bottom = y1 / scale;
    setRect(this.strips[0], 0, 0, screenW, top);
    setRect(this.strips[1], 0, bottom, screenW, screenH - bottom);
    setRect(this.strips[2], 0, top, left, bottom - top);
    setRect(this.strips[3], right, top, screenW - right, bottom - top);
    Navi.markLayoutDirty();
  }

  public destroy() {
    for (const strip of this.strips) Navi.remove(strip, Navi.root);
  }

  private setVisible(shown: boolean) {
    for (const strip of this.strips) strip.setActive(shown);
  }
}

export class UICallout {
  private readonly box: UINode;
  // waits two layout frames so pixelBox.w/h is measured before showing
  private placedFrames = 0;

  constructor(
    public readonly tag: string,
    message: TextContent,
  ) {
    this.box = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        input: "none",
        style: {
          ...panelStyle("small", UI_THEME.colors.accent),
          zIndex: UI_EFFECTS.calloutZIndex,
        },
      }),
    );
    paragraph(this.box, textSource(message), { maxWidth: UI_THEME.tooltip.maxWidth });
    this.box.motion.alpha = 0;
    this.box.setActive(false);
  }

  public sync() {
    const target = findVisible(this.tag);
    if (!target || target.pixelBox.w <= 0 || target.pixelBox.h <= 0) {
      this.box.setActive(false);
      this.box.motion.alpha = 0;
      this.placedFrames = 0;
      return;
    }
    this.box.setActive(true);
    placeBesideBox(this.box, target.pixelBox, UI_EFFECTS.calloutGap);
    if (this.placedFrames < 2) this.placedFrames++;
    else this.box.motion.alpha = 1;
  }

  public destroy() {
    Navi.remove(this.box, Navi.root);
  }
}

function findVisible(tag: string) {
  return Navi.find(tag).find((node) => isVisibleInTree(node));
}

function setRect(node: UINode, x: number, y: number, width: number, height: number) {
  node.position = { x: px(x), y: px(y) };
  node.size = { width: px(Math.max(width, 0)), height: px(Math.max(height, 0)) };
}

function placeBesideBox(popup: UINode, target: Box, offset: number) {
  const scale = Navi.getScale;
  const screen = Navi.root.pixelBox;
  const margin = UI_THEME.spacing.screenMargin * scale;
  const gap = offset * scale;
  const width = popup.pixelBox.w;
  const height = popup.pixelBox.h;
  const centeredX = AxiomMath.clamp(target.x + (target.w - width) / 2, margin, Math.max(margin, screen.w - margin - width));
  let x = centeredX;
  let y = target.y - gap - height;
  if (y < margin) y = target.y + target.h + gap;
  if (y + height > screen.h - margin) {
    y = AxiomMath.clamp(target.y + (target.h - height) / 2, margin, Math.max(margin, screen.h - margin - height));
    x = target.x - gap - width;
    if (x < margin) x = target.x + target.w + gap;
  }
  const left = x / scale;
  const top = y / scale;
  if (left === popup.position.x.value && top === popup.position.y.value) return;
  popup.position = { x: px(left), y: px(top) };
  Navi.markLayoutDirty();
}

function slideOffset(node: UINode, transition: Exclude<UITransition, "fade" | "pop">): Position2D {
  const scale = Navi.getScale;
  const width = node.pixelBox.w > 0 ? node.pixelBox.w / scale + UI_THEME.spacing.screenMargin : UI_EFFECTS.slideFallback;
  const height = node.pixelBox.h > 0 ? node.pixelBox.h / scale + UI_THEME.spacing.screenMargin : UI_EFFECTS.slideFallback;
  if (transition === "slideLeft") return { x: -width, y: 0 };
  if (transition === "slideRight") return { x: width, y: 0 };
  if (transition === "slideTop") return { x: 0, y: -height };
  return { x: 0, y: height };
}

function enterTween(node: UINode, transition: UITransition): Tween {
  if (transition === "fade") return Tweens.fadeIn();
  if (transition === "pop") return Tweens.popIn();
  return Tweens.slideIn(slideOffset(node, transition));
}

function exitTween(node: UINode, transition: UITransition, onDone: () => void): Tween {
  if (transition === "fade") return Tweens.fadeOut(200, Easing.easeInQuad, onDone);
  if (transition === "pop") return Tweens.popOut(140, Easing.easeInCubic, onDone);
  return Tweens.slideOut(slideOffset(node, transition), 180, Easing.easeInCubic, onDone);
}
