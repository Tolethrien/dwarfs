import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto, px } from "@navi/units";
import Time from "@engine/time";
import type Calendar from "../systems/calendar";
import { UI_THEME } from "../content/ui";
import { hudLayer } from "./hud";
import { text } from "./elements/text";
import { row } from "./elements/row";
import { button, runClicked } from "./elements/button";
import { panelStyle } from "./elements/panel";

const SPEEDS = [1, 2, 5, 25];

export default class ClockHud {
  private readonly panel: UINode;
  private speed = 1;

  constructor(calendar: Calendar) {
    this.panel = Navi.append(
      new UINode({
        position: { x: px(0), y: px(UI_THEME.spacing.screenMargin) },
        size: { width: auto(), height: auto() },
        style: {
          anchorX: "center",
          anchorY: "start",
          ...panelStyle("hud"),
          layout: "stack",
          direction: "row",
          alignCross: "center",
          gap: UI_THEME.spacing.gap,
        },
      }),
      hudLayer(),
    );
    const date = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: UI_THEME.colors.accent,
          padding: { top: 4, right: 12, bottom: 4, left: 12 },
          layout: "stack",
          alignCross: "center",
        },
      }),
      this.panel,
    );
    text(date, () => calendar.dateText, { size: UI_THEME.text.header, font: UI_THEME.font.display });
    const speeds = row(this.panel, { fit: true });
    button(speeds, "II", () => Time.setPaused(!Time.getPaused()), { selected: () => Time.getPaused() });
    for (const option of SPEEDS)
      button(speeds, `x${option}`, () => this.select(option), {
        selected: () => !Time.getPaused() && option === this.speed,
      });
    this.select(1);
  }

  public update() {
    runClicked(this.panel);
  }

  private select(speed: number) {
    Time.setPaused(false);
    Time.setTimeSpeed(speed);
    this.speed = speed;
  }
}
