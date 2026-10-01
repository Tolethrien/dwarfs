import Navi from "@navi/navi";
import UINode from "@navi/node";
import UIText from "@navi/elements/text";
import { auto, ph, pw } from "@navi/units";
import AxiomColor, { COLOR } from "@axiom/color";

const LOOK = {
  dim: AxiomColor.withAlpha(COLOR.BLACK, 140),
  box: AxiomColor.withAlpha(COLOR.CHARCOAL, 235),
  button: COLOR.DARK_GRAY,
  buttonHover: COLOR.GRAY,
  text: COLOR.SNOW,
  muted: COLOR.SILVER,
};

// full screen modal: blurs and dims what is behind, takes the mouse from the game.
// Raw look until the menu design exists
export default class MenuPanel {
  private readonly root: UINode;
  private readonly box: UINode;
  private readonly actions = new Map<UINode, () => void>();

  constructor(props: { blur: number }) {
    this.root = Navi.append(
      new UINode({
        size: { width: pw(100), height: ph(100) },
        style: {
          backgroundColor: LOOK.dim,
          backdrop: props.blur > 0 ? { blur: props.blur } : undefined,
          layout: "stack",
          direction: "col",
          alignMain: "center",
          alignCross: "center",
          zIndex: 100,
        },
      }),
    );
    this.box = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: LOOK.box,
          rounded: 0.05,
          layout: "stack",
          direction: "col",
          alignCross: "stretch",
          gap: 10,
          padding: { top: 24, right: 32, bottom: 24, left: 32 },
        },
      }),
      this.root,
    );
  }

  title(text: string) {
    this.text(text, 26, LOOK.text);
  }

  note(text: string | (() => string)) {
    this.text(text, 13, LOOK.muted);
  }

  button(label: string | (() => string), onClick: () => void) {
    const button = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        input: "absorb",
        style: {
          backgroundColor: LOOK.button,
          rounded: 0.2,
          transitionMs: 90,
          layout: "stack",
          alignMain: "center",
          alignCross: "center",
          padding: { top: 10, right: 24, bottom: 10, left: 24 },
        },
        states: { hovered: { backgroundColor: LOOK.buttonHover } },
      }),
      this.box,
    );
    const source = typeof label === "string" ? () => label : label;
    Navi.append(
      new UIText(source, {
        size: { width: auto(), height: auto() },
        inheritState: true,
        style: { textColor: LOOK.text, textSize: 16 },
      }),
      button,
    );
    this.actions.set(button, onClick);
  }

  // call every frame from the owning system
  update() {
    const clicked = Navi.getClicked;
    if (clicked) this.actions.get(clicked)?.();
  }

  destroy() {
    Navi.remove(this.root, Navi.root);
  }

  private text(text: string | (() => string), size: number, color: RGBA) {
    const source = typeof text === "string" ? () => text : text;
    Navi.append(
      new UIText(source, {
        size: { width: auto(), height: auto() },
        input: "none",
        style: { textColor: color, textSize: size, alignSelf: "center" },
      }),
      this.box,
    );
  }
}
