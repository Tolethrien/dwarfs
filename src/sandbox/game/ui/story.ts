import Navi from "@navi/navi";
import UINode from "@navi/node";
import { Tweens } from "@navi/tween";
import { auto, ph, pw, px, type Unit } from "@navi/units";
import { COLOR } from "@axiom/color";
import { UI_THEME } from "../content/ui";
import { button, runClicked } from "./elements/button";
import { text } from "./elements/text";
import { paragraph } from "./elements/paragraph";
import { UIWindow } from "./elements/window";
import { input } from "./elements/input";
import { UICurtain } from "./elements/curtain";
import { CoroutineAnswer } from "@engine/coroutines/coroutine";
import { panelStyle } from "./elements/panel";

// fromBottom: the bar's bottom edge, in percent of the screen's height; fromTop: pixels from the top
// edge for the bar over an open window; letterbox: the black strips over and under the view while the
// player has no control; skip: the corner button's distance from the screen's top right
const STORY_UI = {
  popup: { width: 460, close: "Got it" },
  fromBottom: 25,
  fromTop: 24,
  pulse: { amount: 0.04, ms: 1400 },
  letterbox: { height: 64, outMs: 500 },
  skip: { label: "Skip", margin: 16 },
  letter: { width: 560, nameLength: 24 },
};

export interface StoryPopup {
  title: string;
  lines: string[];
}

export interface StoryLetter {
  title: string;
  lines: string[];
  name: string;
  sign: string;
}

// top: while a window is open, the bottom bar would cover it
export type HintPlace = "bottom" | "top";

export default class StoryUI {
  // the game opens in the dark, the intro brightens it
  public readonly curtain = new UICurtain(true);
  private readonly bars: Record<HintPlace, UINode>;
  private bar: UINode;
  private letterbox: UINode[] = [];
  private readonly skip: UINode;
  private onSkip: (() => void) | undefined;
  private window: UIWindow | undefined;
  // one over another window is run by that window's update
  private owned = false;
  private letter: UIWindow | undefined;

  constructor() {
    const skip = STORY_UI.skip;
    this.skip = Navi.append(
      new UINode({
        position: { x: px(skip.margin), y: px(skip.margin) },
        size: { width: auto(), height: auto() },
        style: { anchorX: "end", anchorY: "start", zIndex: 1 },
      }),
    );
    button(this.skip, skip.label, () => this.onSkip?.());
    this.skip.setActive(false);
    this.bars = { bottom: createBar("end", ph(STORY_UI.fromBottom)), top: createBar("start", px(STORY_UI.fromTop)) };
    this.bar = this.bars.bottom;
  }

  public update() {
    if (!this.owned) this.window?.update();
    this.letter?.update();
    runClicked(this.bar, this.skip);
  }

  public showSkip(onSkip: (() => void) | undefined) {
    this.onSkip = onSkip;
    this.skip.setActive(onSkip !== undefined);
  }

  // it closes only by its button; over a window, it holds that window's input off and keeps it open
  public popup(popup: StoryPopup, over?: UIWindow) {
    const closed = new CoroutineAnswer<void>(() => window.close(), "popup");
    const window = new UIWindow({
      kind: "modal",
      width: STORY_UI.popup.width,
      title: popup.title,
      required: true,
      owner: over,
      onClose: () => {
        this.window = undefined;
        closed.give();
      },
    });
    this.window = window;
    this.owned = over !== undefined;
    const content = window.open();
    for (const line of popup.lines) paragraph(content, line);
    button(content, STORY_UI.popup.close, () => window.close(), { big: true });
    return closed;
  }

  public offer(label: string) {
    this.show("bottom");
    const pressed = new CoroutineAnswer<void>(() => this.hideBars(), label);
    button(this.bar, label, () => pressed.give(), { big: true, pulse: STORY_UI.pulse });
    return pressed;
  }

  // it can't be closed but by signing, with a name: the button or Enter; a skip leaves it unsigned
  public showLetter(letter: StoryLetter) {
    this.hideBars();
    const signed = new CoroutineAnswer<string>(() => {
      this.closeLetter();
      return "";
    }, "signature");
    const window = new UIWindow({ kind: "modal", width: STORY_UI.letter.width, title: letter.title, required: true });
    this.letter = window;
    const content = window.open();
    for (const line of letter.lines) paragraph(content, line);
    const trySign = (name: string) => {
      if (name.trim().length === 0) {
        field.play(Tweens.shake());
        return;
      }
      this.closeLetter();
      signed.give(name.trim());
    };
    const field = input(content, {
      placeholder: letter.name,
      maxLength: STORY_UI.letter.nameLength,
      keepOnBlur: true,
      submit: trySign,
    });
    button(content, letter.sign, () => trySign(field.value), { big: true });
    return signed;
  }

  public hint(line: string, place: HintPlace = "bottom") {
    this.show(place);
    text(this.bar, line, { size: UI_THEME.text.bigButton });
  }

  public hide() {
    this.closeLetter();
    this.hideBars();
  }

  public openLetterbox() {
    const letterbox = STORY_UI.letterbox;
    this.letterbox = (["start", "end"] as const).map((edge) =>
      Navi.append(
        new UINode({
          size: { width: pw(100), height: px(letterbox.height) },
          input: "ignore",
          style: { anchorX: "center", anchorY: edge, backgroundColor: COLOR.BLACK },
        }),
      ),
    );
  }

  public closeLetterbox() {
    const letterbox = STORY_UI.letterbox;
    for (const [index, strip] of this.letterbox.entries()) {
      const away = index === 0 ? -letterbox.height : letterbox.height;
      strip.play(Tweens.slideOut({ x: 0, y: away }, letterbox.outMs, undefined, () => Navi.remove(strip, Navi.root)));
    }
    this.letterbox = [];
  }

  public destroy() {
    this.window?.close();
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
      Navi.clear(bar);
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
        ...panelStyle("hud"),
        layout: "stack",
        direction: "row",
        alignCross: "center",
        gap: UI_THEME.spacing.windowGap,
        zIndex: 1,
      },
    }),
  );
  bar.setActive(false);
  return bar;
}
