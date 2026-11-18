import Navi from "@navi/navi";
import UINode from "@navi/node";
import { Tweens } from "@navi/tween";
import { auto, ph, pw, px } from "@navi/units";
import { COLOR } from "@axiom/color";
import { UI_THEME } from "../content/ui";
import { button, UIButton } from "./elements/button";
import { text } from "./elements/text";

// fromBottom: the bar's bottom edge, in percent of the screen's height; letterbox: the black strips
// over and under the view while the player has no control; skip: the corner button's distance from
// the screen's top right
const INTRO_UI = {
  fromBottom: 25,
  pulse: { amount: 0.04, ms: 1400 },
  letterbox: { height: 64, outMs: 500 },
  skip: { label: "Skip", margin: 16 },
};

export default class IntroUI {
  private readonly bar: UINode;
  private readonly letterbox: UINode[];
  private readonly skip: UINode;

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
    this.bar = Navi.append(
      new UINode({
        position: { x: px(0), y: ph(INTRO_UI.fromBottom) },
        size: { width: auto(), height: auto() },
        style: {
          anchorX: "center",
          anchorY: "end",
          backgroundColor: UI_THEME.colors.panel,
          outline: { width: UI_THEME.outline.window, color: UI_THEME.colors.frame },
          rounded: UI_THEME.radius.window,
          layout: "stack",
          direction: "row",
          alignCross: "center",
          gap: UI_THEME.spacing.windowGap,
          padding: UI_THEME.spacing.buttonPadding,
        },
      }),
    );
    this.bar.setActive(false);
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
    const clicked = Navi.getClicked;
    if (!(clicked instanceof UIButton) || clicked.isDisabled) return;
    if (this.bar.active && clicked.isDescendantOf(this.bar)) clicked.run();
    if (this.skip.active && clicked.isDescendantOf(this.skip)) clicked.run();
  }

  public hideSkip() {
    this.skip.setActive(false);
  }

  public offer(label: string, run: () => void) {
    this.clear();
    button(this.bar, label, run, { big: true, pulse: INTRO_UI.pulse });
    this.bar.setActive(true);
  }

  public hint(line: string) {
    this.clear();
    text(this.bar, line, { size: UI_THEME.text.bigButton });
    this.bar.setActive(true);
  }

  public hide() {
    this.clear();
    this.bar.setActive(false);
  }

  public closeLetterbox() {
    const letterbox = INTRO_UI.letterbox;
    for (const [index, strip] of this.letterbox.entries()) {
      const away = index === 0 ? -letterbox.height : letterbox.height;
      strip.play(Tweens.slideOut({ x: 0, y: away }, letterbox.outMs, undefined, () => Navi.remove(strip, Navi.root)));
    }
  }

  public destroy() {
    Navi.remove(this.bar, Navi.root);
    Navi.remove(this.skip, Navi.root);
    for (const strip of this.letterbox) if (strip.parent) Navi.remove(strip, Navi.root);
  }

  private clear() {
    for (const child of [...this.bar.children]) Navi.remove(child, this.bar);
  }
}
