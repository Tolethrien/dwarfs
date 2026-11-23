import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, px } from "@navi/units";
import { COLOR } from "@axiom/color";
import { UI_SHEET, UI_THEME } from "../content/ui";
import { text } from "./elements/text";
import { button, runClicked } from "./elements/button";

export interface ShootingBarActions {
  stop: () => void;
}

export default class ShootingBarUI {
  private readonly bar: UINode;
  private text: () => string = () => "";

  constructor(private readonly actions: ShootingBarActions) {
    const sheet = UI_SHEET.hudBarMedA;
    // not in the HUD layer: the intro hides the HUD, and the player shoots in it
    this.bar = Navi.append(
      new UINode({
        position: { x: px(0), y: px(UI_THEME.spacing.screenMargin) },
        size: { width: auto(), height: auto() },
        style: {
          anchorX: "center",
          anchorY: "end",
          backgroundColor: COLOR.WHITE,
          backgroundImage: UI_SHEET.image,
          backgroundImageCrop: sheet.crop,
          backgroundImageSlice: sheet.slice,
          padding: { top: 13, right: 20, bottom: 13, left: 22 },
          layout: "stack",
          direction: "row",
          alignCross: "center",
          gap: UI_THEME.spacing.windowGap,
        },
      }),
    );
    text(this.bar, () => this.text(), {
      color: UI_THEME.paper.inkCream,
      size: UI_THEME.text.button,
      font: UI_THEME.font.display,
    });
    button(this.bar, "Stop shooting", () => this.actions.stop(), { sprite: "red" });
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
