import Navi from "@navi/navi";
import UINode from "@navi/node";
import { Tweens } from "@navi/tween";
import { auto, ph, pw, px, type Unit } from "@navi/units";
import { COLOR } from "@axiom/color";
import { UI_THEME } from "../content/ui";
import { button, UIButton } from "./elements/button";
import { text } from "./elements/text";
import { paragraph } from "./elements/paragraph";
import { UIWindow } from "./elements/window";
import { input } from "./elements/input";
import { UICurtain } from "./elements/curtain";

// fromBottom: the bar's bottom edge, in percent of the screen's height; fromTop: pixels from the top
// edge for the bar over an open window; letterbox: the black strips over and under the view while the
// player has no control; skip: the corner button's distance from the screen's top right
const INTRO_UI = {
  fromBottom: 25,
  fromTop: 24,
  pulse: { amount: 0.04, ms: 1400 },
  letterbox: { height: 64, outMs: 500 },
  skip: { label: "Skip", margin: 16 },
  letter: { width: 560, nameLength: 24 },
};

export interface IntroLetter {
  title: string;
  lines: string[];
  name: string;
  sign: string;
}

// top: while a window is open, the bottom bar would cover it
export type HintPlace = "bottom" | "top";

export default class IntroUI {
  private readonly bars: Record<HintPlace, UINode>;
  private bar: UINode;
  private readonly letterbox: UINode[];
  // made before the skip button, which stays over it
  public readonly curtain = new UICurtain(true);
  private readonly skip: UINode;
  private letter: UIWindow | undefined;

  constructor(onSkip: () => void) {
    const skip = INTRO_UI.skip;
    this.skip = Navi.append(
      new UINode({
        position: { x: px(skip.margin), y: px(skip.margin) },
        size: { width: auto(), height: auto() },
        style: { anchorX: "end", anchorY: "start", zIndex: 1 },
      }),
    );
    button(this.skip, skip.label, onSkip);
    this.bars = { bottom: createBar("end", ph(INTRO_UI.fromBottom)), top: createBar("start", px(INTRO_UI.fromTop)) };
    this.bar = this.bars.bottom;
    const letterbox = INTRO_UI.letterbox;
    this.letterbox = (["start", "end"] as const).map((edge) => {
      return Navi.append(
        new UINode({
          size: { width: pw(100), height: px(letterbox.height) },
          input: "ignore",
          style: { anchorX: "center", anchorY: edge, backgroundColor: COLOR.BLACK },
        }),
      );
    });
  }

  public update() {
    this.letter?.update();
    const clicked = Navi.getClicked;
    if (!(clicked instanceof UIButton) || clicked.isDisabled) return;
    if (this.bar.active && clicked.isDescendantOf(this.bar)) clicked.run();
    if (this.skip.active && clicked.isDescendantOf(this.skip)) clicked.run();
  }

  public hideSkip() {
    this.skip.setActive(false);
  }

  public offer(label: string) {
    this.show("bottom");
    return new Promise<void>((resolve) => button(this.bar, label, resolve, { big: true, pulse: INTRO_UI.pulse }));
  }

  // it can't be closed but by signing, with a name: the button or Enter
  public showLetter(letter: IntroLetter) {
    this.hideBars();
    const signed = Promise.withResolvers<string>();
    const window = new UIWindow({ kind: "modal", width: INTRO_UI.letter.width, title: letter.title, required: true });
    this.letter = window;
    const content = window.open();
    for (const line of letter.lines) paragraph(content, line);
    const trySign = (name: string) => {
      if (name.trim().length === 0) {
        field.play(Tweens.shake());
        return;
      }
      this.closeLetter();
      signed.resolve(name.trim());
    };
    const field = input(content, {
      placeholder: letter.name,
      maxLength: INTRO_UI.letter.nameLength,
      keepOnBlur: true,
      submit: trySign,
    });
    button(content, letter.sign, () => trySign(field.value), { big: true });
    return signed.promise;
  }

  public hint(line: string, place: HintPlace = "bottom") {
    this.show(place);
    text(this.bar, line, { size: UI_THEME.text.bigButton });
  }

  public hide() {
    this.closeLetter();
    this.hideBars();
  }

  public closeLetterbox() {
    const letterbox = INTRO_UI.letterbox;
    for (const [index, strip] of this.letterbox.entries()) {
      const away = index === 0 ? -letterbox.height : letterbox.height;
      strip.play(Tweens.slideOut({ x: 0, y: away }, letterbox.outMs, undefined, () => Navi.remove(strip, Navi.root)));
    }
  }

  public destroy() {
    this.closeLetter();
    Navi.remove(this.bars.bottom, Navi.root);
    Navi.remove(this.bars.top, Navi.root);
    Navi.remove(this.skip, Navi.root);
    for (const strip of this.letterbox) if (strip.parent) Navi.remove(strip, Navi.root);
    this.curtain.destroy();
  }

  private show(place: HintPlace) {
    this.hideBars();
    this.bar = this.bars[place];
    this.bar.setActive(true);
  }

  private hideBars() {
    for (const bar of Object.values(this.bars)) {
      for (const child of [...bar.children]) Navi.remove(child, bar);
      bar.setActive(false);
    }
  }

  private closeLetter() {
    this.letter?.close();
    this.letter = undefined;
  }
}

function createBar(anchorY: "start" | "end", y: Unit) {
  const bar = Navi.append(
    new UINode({
      position: { x: px(0), y: y },
      size: { width: auto(), height: auto() },
      style: {
        anchorX: "center",
        anchorY: anchorY,
        backgroundColor: UI_THEME.colors.panel,
        outline: { width: UI_THEME.outline.window, color: UI_THEME.colors.frame },
        rounded: UI_THEME.radius.window,
        layout: "stack",
        direction: "row",
        alignCross: "center",
        gap: UI_THEME.spacing.windowGap,
        padding: UI_THEME.spacing.buttonPadding,
        zIndex: 1,
      },
    }),
  );
  bar.setActive(false);
  return bar;
}
