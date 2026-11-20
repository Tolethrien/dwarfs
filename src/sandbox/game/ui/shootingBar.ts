import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, px } from "@navi/units";
import { UI_THEME } from "../content/ui";
import { text } from "./elements/text";
import { button, runClicked } from "./elements/button";
import { panelStyle } from "./elements/panel";

export interface ShootingBarActions {
  stop: () => void;
}

export default class ShootingBarUI {
  private readonly bar: UINode;
  private text: () => string = () => "";

  constructor(private readonly actions: ShootingBarActions) {
    // not in the HUD layer: the intro hides the HUD, and the player shoots in it
    this.bar = Navi.append(
      new UINode({
        position: { x: px(0), y: px(UI_THEME.spacing.screenMargin) },
        size: { width: auto(), height: auto() },
        style: {
          anchorX: "center",
          anchorY: "end",
          ...panelStyle("hud"),
          layout: "stack",
          direction: "row",
          alignCross: "center",
          gap: UI_THEME.spacing.windowGap,
        },
      }),
    );
    text(this.bar, () => this.text(), { size: UI_THEME.text.button });
    button(this.bar, "Stop shooting", () => this.actions.stop());
    this.bar.setActive(false);
  }

  public update() {
    runClicked(this.bar);
  }

  public show(text: () => string) {
    this.text = text;
    this.bar.setActive(true);
  }

  public hide() {
    this.bar.setActive(false);
  }
}
