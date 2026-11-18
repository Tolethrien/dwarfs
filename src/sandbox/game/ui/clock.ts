import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, px } from "@navi/units";
import Time from "@engine/time";
import type Calendar from "../systems/calendar";
import { UI_THEME } from "../content/ui";
import { hudLayer } from "./hud";
import { text } from "./elements/text";
import { row } from "./elements/row";
import { button, UIButton } from "./elements/button";

const SPEEDS = [1, 2, 5, 25];

export default class ClockHud {
  private readonly panel: UINode;
  private readonly speeds: UINode;
  private speed = 1;

  constructor(calendar: Calendar) {
    this.panel = Navi.append(
      new UINode({
        position: { x: px(0), y: px(UI_THEME.spacing.screenMargin) },
        size: { width: auto(), height: auto() },
        style: {
          anchorX: "center",
          anchorY: "start",
          backgroundColor: UI_THEME.colors.panel,
          outline: { width: UI_THEME.outline.window, color: UI_THEME.colors.frame },
          rounded: UI_THEME.radius.window,
          padding: UI_THEME.spacing.buttonPadding,
          layout: "stack",
          direction: "row",
          alignCross: "center",
          gap: UI_THEME.spacing.gap,
        },
      }),
      hudLayer(),
    );
    text(this.panel, () => calendar.dateText, { size: UI_THEME.text.button });
    this.speeds = row(this.panel, { fit: true });
    this.select(1);
  }

  public update() {
    const clicked = Navi.getClicked;
    if (!(clicked instanceof UIButton) || clicked.isDisabled) return;
    if (clicked.isDescendantOf(this.panel)) clicked.run();
  }

  private select(speed: number) {
    Time.setPaused(false);
    Time.setTimeSpeed(speed);
    this.speed = speed;
    this.showButtons();
  }

  private togglePause() {
    Time.setPaused(!Time.getPaused());
    this.showButtons();
  }

  private showButtons() {
    const paused = Time.getPaused();
    for (const child of [...this.speeds.children]) Navi.remove(child, this.speeds);
    button(this.speeds, "II", () => this.togglePause(), { selected: paused });
    for (const option of SPEEDS)
      button(this.speeds, `x${option}`, () => this.select(option), { selected: !paused && option === this.speed });
  }
}
