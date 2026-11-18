import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, px } from "@navi/units";
import { UI_THEME } from "../content/ui";
import { text } from "./elements/text";
import { button, UIButton } from "./elements/button";

export interface ShootingBarActions {
  stop: () => void;
}

export default class ShootingBarUI {
  private readonly bar: UINode;
  private text: () => string = () => "";

  constructor(private readonly actions: ShootingBarActions) {
    this.bar = Navi.append(
      new UINode({
        position: { x: px(0), y: px(UI_THEME.spacing.screenMargin) },
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
    text(this.bar, () => this.text(), { size: UI_THEME.text.button });
    button(this.bar, "Stop shooting", () => this.actions.stop());
    this.bar.setActive(false);
  }

  public update() {
    if (!this.bar.active) return;
    const clicked = Navi.getClicked;
    if (!(clicked instanceof UIButton) || clicked.isDisabled) return;
    if (clicked.isDescendantOf(this.bar)) clicked.run();
  }

  public show(text: () => string) {
    this.text = text;
    this.bar.setActive(true);
  }

  public hide() {
    this.bar.setActive(false);
  }
}
